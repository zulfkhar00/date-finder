// The Reply helper generator: claim a slot (caps), ask the model (retry with backoff inside a time budget), validate,
// save the thread. Every side effect is injected, so scripts/check-reply-helper.ts drives it with a stub model and an
// in-memory store and never calls Anthropic.
//
// Privacy: screenshots, pasted text and model output exist only in memory here. Nothing is logged; every failure is
// reduced to a short code (rate_limited, timeout, refusal, ...) which is the only thing stored or reported.
import { PackError, type PackModel } from "@/lib/starter-pack/generate";
import { CALL_TIMEOUT_MS, MAX_TRIES_PER_RUN, RUN_BUDGET_MS, backoffMs, weightedTokens, type ReplyLimits } from "./limits";
import { REPLY_SYSTEM_PROMPT, buildReplyUserPrompt } from "./prompts";
import type { ReplyStore } from "./store";
import { REPLY_MODEL, type ReplyContext, type ReplyInput, type ReplyOutcome, type ThreadRow, type ThreadView } from "./types";
import { checkReply } from "./validate";

export type ReplyDeps = {
  store: ReplyStore;
  model: PackModel;
  limits: ReplyLimits;
  /** The cleaned context for the prompt, or null when the user is gone. */
  loadContext(userId: string): Promise<ReplyContext | null>;
  sleep?(ms: number): Promise<void>;
  now?(): Date;
  /** Monotonic milliseconds, for the run budget. */
  clock?(): number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function toView(row: Pick<ThreadRow, "id" | "source" | "image_count" | "tweak" | "updated_at" | "drafts">): ThreadView {
  return { id: row.id, source: row.source, imageCount: row.image_count, tweak: row.tweak, updatedAt: row.updated_at, drafts: row.drafts };
}

export async function runReply(deps: ReplyDeps, userId: string, input: ReplyInput): Promise<ReplyOutcome> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? defaultSleep;
  const clock = deps.clock ?? (() => Date.now());
  const started = clock();

  let ctx: ReplyContext | null;
  try { ctx = await deps.loadContext(userId); } catch { return { status: "failed", code: "context" }; }
  if (!ctx) return { status: "failed", code: "user_gone" };

  let claim;
  try {
    claim = await deps.store.claim({ userId, kind: input.kind, threadId: input.kind === "new" ? null : input.thread.id, now: now(), limits: deps.limits });
  } catch { return { status: "failed", code: "internal" }; }
  if (!claim.ok) return { status: "denied", reason: claim.reason };
  const runId = claim.runId;

  let spent = 0;
  const done = async <T extends ReplyOutcome>(outcome: T, code: string): Promise<T> => {
    await deps.store.finish(runId, { tokens: spent, outcome: code, now: now() }).catch(() => undefined);
    return outcome;
  };

  try {
    const images = input.kind === "new" ? input.images : [];
    let feedback: string[] | undefined;
    let lastCode = "model_error";
    for (let tries = 0; tries < MAX_TRIES_PER_RUN; tries++) {
      if (tries > 0) {
        const wait = backoffMs(tries);
        if (clock() - started + wait + CALL_TIMEOUT_MS > RUN_BUDGET_MS) break; // no time for another try: fail friendly, not by a platform timeout
        await sleep(wait);
      }
      try {
        const user = buildReplyUserPrompt(ctx, input.kind === "new"
          ? { text: input.text, imageCount: images.length }
          : { transcript: input.thread.transcript, previous: input.thread.drafts, tweak: input.tweak }, feedback);
        const res = await deps.model.complete({ system: REPLY_SYSTEM_PROMPT, user, images, maxTokens: 1800, model: REPLY_MODEL });
        spent += weightedTokens(res.inputTokens, res.outputTokens);
        if (res.stopReason === "refusal") return await done({ status: "refused" }, "refusal");
        if (res.stopReason === "max_tokens") { lastCode = "truncated"; feedback = ["the answer was cut off; be more concise"]; continue; }
        const checked = checkReply(res.text);
        if (checked.ok) {
          const saved = await deps.store.saveThread({
            userId, threadId: input.kind === "new" ? null : input.thread.id,
            source: input.kind === "new" ? (input.text ? "text" : "screenshots") : input.thread.source,
            imageCount: input.kind === "new" ? images.length : input.thread.image_count,
            drafts: checked.drafts, transcript: checked.transcript, tweak: input.kind === "new" ? null : input.tweak, now: now()
          });
          if (!saved) return await done({ status: "failed", code: "thread_gone" }, "thread_gone");
          return await done({ status: "ok", thread: toView(saved) }, "ok");
        }
        if (checked.kind === "unsafe") return await done({ status: "refused" }, "unsafe");
        if (checked.kind === "unreadable") {
          // A regenerate works from text we already read, so "unreadable" there is a model hiccup, not the user's screenshot.
          if (input.kind !== "new") { lastCode = "unreadable_again"; continue; }
          return await done({ status: "unreadable" }, "unreadable");
        }
        lastCode = checked.code;
        feedback = [checked.feedback];
      } catch (error) {
        const e = error instanceof PackError ? error : new PackError("model_error", true);
        spent += weightedTokens(e.inputTokens, e.outputTokens);
        lastCode = e.code;
        if (!e.retryable) return await done({ status: "failed", code: e.code }, e.code);
      }
    }
    return await done({ status: "failed", code: lastCode }, lastCode);
  } catch {
    // Storage or an unexpected bug: a code only, never the error text.
    return await done({ status: "failed", code: "internal" }, "internal");
  }
}
