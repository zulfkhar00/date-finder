// Parses and checks what the model returned for the Reply helper. Pure. Nothing here logs: the strings are private.
import { UNSAFE, extractJson } from "@/lib/starter-pack/validate";
import { draftsSchema, modelOutputSchema, type Drafts, type Turn } from "./types";

export type Checked =
  | { ok: true; drafts: Drafts; transcript: Turn[] }
  | { ok: false; kind: "unreadable" }
  | { ok: false; kind: "unsafe" }
  | { ok: false; kind: "invalid"; code: "bad_json" | "bad_shape" | "unsafe_text" | "self_reveal" | "duplicates"; feedback: string };

/** Lines that give the game away. The prompt forbids them; this enforces it. */
const SELF_REVEAL = /\b(as an ai|i am an ai|i'm an ai|language model|noswipe (?:wrote|helped|suggested)|written by noswipe|ai[- ]generated|chatgpt)\b/i;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function checkReply(raw: string): Checked {
  const json = extractJson(raw);
  if (json === null) return { ok: false, kind: "invalid", code: "bad_json", feedback: "the reply was not a single JSON object" };
  const parsed = modelOutputSchema.safeParse(json);
  if (!parsed.success) return { ok: false, kind: "invalid", code: "bad_shape", feedback: `wrong JSON shape at ${parsed.error.issues[0]?.path.join(".") || "root"}` };
  const out = parsed.data;
  if (out.status === "unreadable") return { ok: false, kind: "unreadable" };
  if (out.status === "unsafe") return { ok: false, kind: "unsafe" };

  // Exactly three replies: extra ones are dropped, fewer fail the schema below.
  const replies = (out.replies ?? []).slice(0, 3);
  const ready = out.dateMove?.ready === true && !!out.dateMove.line && (out.dateMove.plans?.length ?? 0) >= 2;
  const candidate = {
    language: out.language ?? "English",
    read: out.read ?? "",
    replies,
    dateMove: ready ? { line: out.dateMove!.line!, plans: out.dateMove!.plans!.slice(0, 2) } : null
  };
  const final = draftsSchema.safeParse(candidate);
  if (!final.success) return { ok: false, kind: "invalid", code: "bad_shape", feedback: `wrong JSON shape at ${final.error.issues[0]?.path.join(".") || "root"}` };

  const sendable = [...final.data.replies.map((r) => r.text), ...(final.data.dateMove ? [final.data.dateMove.line, ...final.data.dateMove.plans.map((p) => p.detail)] : [])];
  if (sendable.some((s) => SELF_REVEAL.test(s))) return { ok: false, kind: "invalid", code: "self_reveal", feedback: "a draft mentioned AI or NoSwipe; every draft must read as the user's own words" };
  if (UNSAFE.test(sendable.join("\n"))) return { ok: false, kind: "invalid", code: "unsafe_text", feedback: "it contained sexual, explicit or pressuring wording; keep everything respectful" };
  if (new Set(final.data.replies.map((r) => norm(r.text))).size < 3) return { ok: false, kind: "invalid", code: "duplicates", feedback: "the three replies were not different from each other" };
  return { ok: true, drafts: final.data, transcript: out.transcript ?? [] };
}
