// The generator: claim the pack, ask the model (retry with backoff), validate, store. Every side effect is injected,
// so scripts/check-starter-pack.ts drives it with a stub model and an in-memory store and never calls Anthropic.
//
// Privacy: profile text, photos and model output exist only in memory here. Nothing is logged; failures are
// reduced to a short code (rate_limited, timeout, refusal, ...) that is the only thing stored or reported.
import { MAX_TRIES_PER_RUN, backoffMs, weightedTokens, type PackLimits } from "./limits";
import { VISION_SYSTEM_PROMPT, SYSTEM_PROMPT, buildPackUserPrompt, buildVisionUserPrompt } from "./prompts";
import type { ClaimResult, PackStore } from "./store";
import { PACK_MODEL, PACK_VERSION, packContentSchema, type PackContent, type PackContext, type PackRow, type PhotoSection, type RunKind } from "./types";
import { photoChecklist, validatePhotoRanking, validateTextPack } from "./validate";

export type ModelImage = { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string };
export type ModelRequest = { system: string; user: string; images?: ModelImage[]; maxTokens: number };
export type ModelResponse = { text: string; inputTokens: number; outputTokens: number; stopReason: string | null };
export interface PackModel { complete(request: ModelRequest): Promise<ModelResponse> }

/** A model failure reduced to a code. `retryable` false means trying again would only repeat it (a refusal). */
export class PackError extends Error {
  constructor(readonly code: string, readonly retryable: boolean, readonly inputTokens = 0, readonly outputTokens = 0) { super(code); }
}

export type LoadedPhotos = { photos: { id: string; image: ModelImage }[]; total: number };
export type PackDeps = {
  store: PackStore;
  model: PackModel;
  /** The cleaned context for the prompt, or null when the user is gone or has not finished onboarding. */
  loadContext(userId: string): Promise<PackContext | null>;
  /** Photos as in-memory images. May return fewer than `total` (some failed to load); may throw. */
  loadPhotos(userId: string): Promise<LoadedPhotos>;
  limits: PackLimits;
  sleep?(ms: number): Promise<void>;
  now?(): Date;
};

export type RunOutcome =
  | { status: "ready" }
  | { status: "failed"; code: string }
  | { status: "skipped"; reason: string }
  | { status: "deferred"; reason: "cap" };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type Claim = Extract<ClaimResult, { ok: true }>;

/** Step one: take the lease (or learn why not). Cheap, so a server action can do it before answering. */
export async function claimPack(deps: PackDeps, userId: string, kind: RunKind): Promise<{ claim: Claim } | { outcome: RunOutcome }> {
  const now = deps.now ?? (() => new Date());
  const claim = await deps.store.claim({ userId, version: PACK_VERSION, kind, now: now(), limits: deps.limits });
  if (claim.ok) return { claim };
  return { outcome: claim.reason === "cap" ? { status: "deferred", reason: "cap" } : { status: "skipped", reason: claim.reason } };
}

export async function runPack(deps: PackDeps, userId: string, kind: RunKind): Promise<RunOutcome> {
  const claimed = await claimPack(deps, userId, kind);
  return "outcome" in claimed ? claimed.outcome : executePack(deps, userId, claimed.claim);
}

/** Step two: the slow part (model calls). Always releases the lease: ready, or failed with a code. */
export async function executePack(deps: PackDeps, userId: string, claim: Claim): Promise<RunOutcome> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? defaultSleep;
  const { row, runId } = claim;

  let tries = 0;
  let spent = 0;
  const finish = async (code: string): Promise<RunOutcome> => {
    await deps.store.addTokens(runId, spent).catch(() => undefined);
    await deps.store.fail(row, { code, tries, now: now() });
    return { status: "failed", code };
  };

  try {
    const ctx = await deps.loadContext(userId);
    if (!ctx) return await finish("user_gone");

    // 1. Text: profile rewrite, openers, replies, date plan.
    let feedback: string[] | undefined;
    let text: Extract<ReturnType<typeof validateTextPack>, { ok: true }>["pack"] | null = null;
    let lastCode = "model_error";
    while (tries < MAX_TRIES_PER_RUN && !text) {
      if (tries > 0) await sleep(backoffMs(tries));
      tries += 1;
      try {
        const res = await deps.model.complete({ system: SYSTEM_PROMPT, user: buildPackUserPrompt(ctx, feedback), maxTokens: 3500 });
        spent += weightedTokens(res.inputTokens, res.outputTokens);
        if (res.stopReason === "refusal") return await finish("refusal");
        if (res.stopReason === "max_tokens") { lastCode = "truncated"; feedback = ["the answer was cut off; be more concise"]; continue; }
        const checked = validateTextPack(res.text, ctx);
        if (checked.ok) text = checked.pack;
        else { lastCode = checked.code; feedback = [checked.feedback]; }
      } catch (error) {
        const e = error instanceof PackError ? error : new PackError("model_error", true);
        spent += weightedTokens(e.inputTokens, e.outputTokens);
        lastCode = e.code;
        if (!e.retryable) return await finish(e.code);
      }
    }
    if (!text) return await finish(lastCode);

    // 2. Photos: a failure here never fails the pack; the user gets the checklist instead.
    let photos: PhotoSection = photoChecklist();
    let loaded: LoadedPhotos | null = null;
    try { loaded = await deps.loadPhotos(userId); } catch { loaded = null; }
    if (loaded && loaded.photos.length > 0) {
      const ranked = await rankPhotos(deps, ctx, loaded, sleep);
      spent += ranked.spent;
      photos = ranked.section ?? photoChecklist("We couldn't review your photos this time, so here is what a strong set looks like.");
    } else if (loaded && loaded.total > 0) {
      photos = photoChecklist("We couldn't open your photos this time, so here is what a strong set looks like.");
    }

    const content: PackContent = { v: 1, profiles: text.profiles, photos, openers: text.openers, replies: text.replies, datePlan: text.datePlan };
    const final = packContentSchema.safeParse(content);
    if (!final.success) return await finish("bad_shape");
    await deps.store.addTokens(runId, spent).catch(() => undefined);
    await deps.store.complete(row as PackRow, { content: final.data, model: PACK_MODEL, tries, now: now() });
    return { status: "ready" };
  } catch {
    // Storage or an unexpected bug: record a code and let the sweep retry. Never include the error text.
    return await finish("internal").catch(() => ({ status: "failed" as const, code: "internal" }));
  }
}

async function rankPhotos(deps: PackDeps, ctx: PackContext, loaded: LoadedPhotos, sleep: (ms: number) => Promise<void>): Promise<{ section: PhotoSection | null; spent: number }> {
  let spent = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) await sleep(backoffMs(1));
    try {
      const res = await deps.model.complete({
        system: VISION_SYSTEM_PROMPT, user: buildVisionUserPrompt(ctx, loaded.photos.length),
        images: loaded.photos.map((p) => p.image), maxTokens: 1500
      });
      spent += weightedTokens(res.inputTokens, res.outputTokens);
      if (res.stopReason === "refusal") return { section: null, spent };
      const section = validatePhotoRanking(res.text, loaded.photos);
      if (section) return { section, spent };
    } catch (error) {
      const e = error instanceof PackError ? error : new PackError("model_error", true);
      spent += weightedTokens(e.inputTokens, e.outputTokens);
      if (!e.retryable) break;
    }
  }
  return { section: null, spent };
}
