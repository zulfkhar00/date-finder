import { hashIdentifier, ipKey, readLimits, utcDay, weightedTokens, type RunStore, type TryLimits } from "./limits";
import { MAX_REQUEST_BYTES, type TryErrorCode, type TryKind } from "./shared";
import { validateFields, validateImages } from "./validate";
import type { DraftInput, DraftResult, DraftUsage } from "@/lib/concierge/draft";
import type { DraftOutput } from "@/lib/concierge/types";

// Request handling for POST /api/try, with every side effect injected so it can be smoke-tested with a
// mocked Anthropic client and an in-memory store. Images live only in this function's memory: they are
// never written anywhere, never logged, and never passed to error reporting.

export type TryDeps = {
  store: RunStore;
  draft: (input: DraftInput) => Promise<DraftResult | null>;
  salt: string;
  limits?: TryLimits;
  now?: () => Date;
  /** Records the try_result funnel event. Must never throw. */
  recordResult?: (info: { sessionId: string | null; kind: TryKind }) => void;
  /** Receives a scrubbed error: a short label and an HTTP status, never request or image content. */
  reportError?: (label: string, status?: number) => void;
  /** False for localhost and preview origins, which never count in the funnel. */
  shouldRecord?: (origin: string | null) => boolean;
};

export type TryResponseBody =
  | { ok: true; kind: TryKind; result: PublicResult; remaining: number }
  | { ok: false; code: TryErrorCode; message: string };

type StripInternal<T> = T extends unknown ? Omit<T, "message" | "input_summary" | "edited_message"> : never;
export type PublicResult = StripInternal<DraftOutput>;

function json(body: TryResponseBody, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function fail(code: TryErrorCode, message: string, status: number, headers?: Record<string, string>) {
  return json({ ok: false, code, message }, status, headers);
}

export function clientAddress(headers: Headers): string {
  const raw = headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return ipKey(raw);
}

/**
 * True only when the model certainly did not run (rate limited, timed out, overloaded, server error, or
 * no response at all), so the visitor and the caps get the run back. Anything else (truncated output,
 * refusal, unparsable output, rejected request) may have cost money and stays counted.
 */
export function modelNeverRan(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number") return status === 408 || status === 429 || status >= 500;
  const name = (error as { name?: unknown } | null)?.name;
  return name === "APIConnectionError" || name === "APIConnectionTimeoutError";
}

/** Conservative spend when a failed call gave no usage: about 2.5k tokens per image plus prompt and a full-length reply. */
export function estimatedUsage(imageCount: number): DraftUsage {
  return { inputTokens: 3000 + imageCount * 2500, outputTokens: 1500 };
}

export function toPublicResult(output: DraftOutput): PublicResult {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { message, input_summary, edited_message, ...rest } = output;
  return rest as PublicResult;
}

export async function handleTryRequest(request: Request, deps: TryDeps): Promise<Response> {
  const limits = deps.limits ?? readLimits();
  const now = deps.now?.() ?? new Date();

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) return fail("too_large", "Those pictures are too big to upload together. Remove one or use smaller screenshots.", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalid_input", "We couldn't read that upload. Try again.", 400);
  }

  const fields = validateFields((name) => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  });
  if (!fields.ok) return fail("invalid_input", fields.message, 400);

  const files = form.getAll("images").filter((value): value is File => typeof value !== "string");
  const images = await validateImages(files, fields.kind);
  if (!images.ok) return fail("invalid_input", images.message, 400);

  const day = utcDay(now);
  const ipHash = hashIdentifier(clientAddress(request.headers), deps.salt, day);
  const sessionHash = hashIdentifier(fields.sessionId, deps.salt, day);

  let claim;
  try {
    claim = await deps.store.claim({ ipHash, sessionHash, kind: fields.kind, day, limits });
  } catch {
    deps.reportError?.("try_claim_failed");
    return fail("unavailable", "The free tool is taking a break. Please try again in a few minutes.", 503);
  }
  if (!claim.allowed) {
    if (claim.reason === "cap") {
      return fail("capacity", "Today's free runs are all used up. Come back tomorrow, or get the full concierge.", 429);
    }
    return fail("daily_limit", `You've used your ${limits.sessionPerDay} free tries for today. Come back tomorrow, or get the full concierge.`, 429);
  }

  try {
    const result = await deps.draft({
      kind: fields.kind,
      mode: "self_serve",
      client: { name: "you", voiceNotes: fields.about, apps: [fields.app] },
      images: images.images,
      note: fields.app ? `The user is on ${fields.app}.` : undefined
    });
    if (!result) {
      await deps.store.release(claim.runId).catch(() => undefined); // no API key: the model never ran
      return fail("unavailable", "The free tool is taking a break. Please try again in a few minutes.", 503);
    }
    await deps.store.recordUsage(claim.runId, weightedTokens(result.usage.inputTokens, result.usage.outputTokens)).catch(() => undefined);
    if (deps.shouldRecord?.(request.headers.get("origin")) ?? true) deps.recordResult?.({ sessionId: fields.funnelSessionId, kind: fields.kind });
    return json({ ok: true, kind: fields.kind, result: toPublicResult(result.output), remaining: claim.sessionRemaining }, 200);
  } catch (error) {
    if (modelNeverRan(error)) {
      await deps.store.release(claim.runId).catch(() => undefined);
    } else {
      // The model may have run: the try stays counted and its spend is metered (never refunded).
      const usage = (error as { usage?: DraftUsage } | null)?.usage ?? estimatedUsage(images.images.length);
      await deps.store.recordUsage(claim.runId, weightedTokens(usage.inputTokens, usage.outputTokens)).catch(() => undefined);
    }
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : undefined;
    deps.reportError?.("try_draft_failed", status);
    return fail("failed", modelNeverRan(error) ? "Something went wrong on our side, and that try wasn't counted. Please try again." : "We couldn't turn that into a draft. Try a clearer screenshot or fewer images.", 502);
  }
}
