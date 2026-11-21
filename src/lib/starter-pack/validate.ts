// Parses and checks what the model returned. Pure. Nothing here logs: the strings are the user's pack.
import { BIO_LIMITS, textPackSchema, type PackContext, type PhotoSection, type TextPack } from "./types";
import { canonicalHingePrompt } from "./hinge-prompts";
import { PHOTO_CHECKLIST } from "./prompts";

export type ValidationFailure = { ok: false; code: "bad_json" | "bad_shape" | "cliche" | "unsafe" | "bad_prompts"; feedback: string };

/** Phrases the pack must not contain (the system prompt asks; this enforces). Matched case-insensitively. */
export const CLICHES = [
  "partner in crime", "love to laugh", "live laugh love", "work hard play hard", "fluent in sarcasm", "looking for my",
  "swipe right", "adventurous", "wanderlust", "foodie", "good vibes", "hopeless romantic", "life is short", "life's too short",
  "ask me anything", "netflix and chill", "here for a good time", "sapiosexual"
];
export const UNSAFE = /\b(sex|sexy|sexual|nude|nudes|naked|horny|hook ?up|dick|cock|pussy|boobs?|tits|ass|fuck\w*|blowjob|kinky|fetish|slut|teen|underage|schoolgirl|get drunk)\b/i;
const OPENER_FLOOR = /^(hey|hi|hello|hola|sup|yo)\b[\s,!.?]*$/i;
const EMOJI = /[\p{Extended_Pictographic}️‍]/gu;

export function stripEmoji(value: string): string {
  return value.replace(EMOJI, "").replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)])) as T;
  return value;
}
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

/** Pulls the JSON object out of the model's text, tolerating a code fence or a stray sentence around it. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

export function findCliches(strings: readonly string[]): string[] {
  const hay = strings.join("\n").toLowerCase();
  return CLICHES.filter((c) => hay.includes(c));
}

/** Validates the text call's output against the context (which apps were asked for) and normalises it. */
export function validateTextPack(raw: string, ctx: PackContext): { ok: true; pack: TextPack } | ValidationFailure {
  const json = extractJson(raw);
  if (json === null) return { ok: false, code: "bad_json", feedback: "the reply was not a single JSON object" };
  const parsed = textPackSchema.safeParse(json);
  if (!parsed.success) return { ok: false, code: "bad_shape", feedback: `wrong JSON shape at ${parsed.error.issues[0]?.path.join(".") || "root"}` };

  const clean = mapStrings(parsed.data, stripEmoji);
  const profiles: TextPack["profiles"] = [];
  for (const app of ctx.apps) {
    const entry = clean.profiles.find((p) => p.app === app);
    if (!entry) return { ok: false, code: "bad_shape", feedback: `no profile entry for ${app}` };
    if (entry.bio.length > BIO_LIMITS[app]) return { ok: false, code: "bad_shape", feedback: `${app} bio is longer than ${BIO_LIMITS[app]} characters` };
    if (app === "hinge") {
      const seen = new Set<string>();
      const prompts: { prompt: string; answer: string }[] = [];
      for (const p of entry.prompts ?? []) {
        const title = canonicalHingePrompt(p.prompt);
        if (title && !seen.has(title)) { seen.add(title); prompts.push({ prompt: title, answer: p.answer }); }
      }
      if (prompts.length < 3) return { ok: false, code: "bad_prompts", feedback: "Hinge needs 3 different prompts copied exactly from the list" };
      profiles.push({ app, prompts: prompts.slice(0, 3), bio: entry.bio });
    } else {
      profiles.push({ app, bio: entry.bio });
    }
  }

  const pack: TextPack = {
    profiles,
    openers: clean.openers.slice(0, 5),
    replies: clean.replies.slice(0, 3),
    datePlan: { ...clean.datePlan, venues: clean.datePlan.venues.slice(0, 2) }
  };
  if (pack.openers.some((o) => o.line.length > 160 || OPENER_FLOOR.test(o.line) || o.line.length < 12)) return { ok: false, code: "bad_shape", feedback: "openers must be 12-160 characters and never just a greeting" };

  const strings = allStrings(pack);
  if (UNSAFE.test(strings.join("\n"))) return { ok: false, code: "unsafe", feedback: "it contained sexual, explicit or pressuring wording; keep everything respectful and safe" };
  const cliches = findCliches(strings);
  if (cliches.length) return { ok: false, code: "cliche", feedback: `cliches: ${cliches.join(", ")}` };
  return { ok: true, pack };
}

export type PhotoInput = { id: string };

/** Turns the vision call's JSON into the stored section. Unknown or repeated photo numbers are ignored; missing ones are kept at the end. */
export function validatePhotoRanking(raw: string, photos: readonly PhotoInput[], exclude: ReadonlySet<string> = new Set()): PhotoSection | null {
  const json = extractJson(raw) as { ranking?: unknown; add?: unknown } | null;
  if (!json || !Array.isArray(json.ranking)) return null;
  const seen = new Set<number>();
  const rows: { photo_id: string; role: "lead" | "keep" | "drop"; reason: string }[] = [];
  for (const item of json.ranking as { photo?: unknown; role?: unknown; reason?: unknown }[]) {
    const n = Number(item?.photo);
    if (!Number.isInteger(n) || n < 1 || n > photos.length || seen.has(n)) continue;
    seen.add(n);
    if (exclude.has(photos[n - 1].id)) continue; // flagged for review: never part of the suggested order
    const role = item.role === "lead" || item.role === "drop" ? item.role : "keep";
    const reason = stripEmoji(String(item.reason ?? "")).slice(0, 220).trim();
    if (UNSAFE.test(reason)) continue;
    rows.push({ photo_id: photos[n - 1].id, role, reason: reason || (role === "drop" ? "It weakens the set." : "It works in this spot.") });
  }
  if (rows.length === 0) return null;
  photos.forEach((p, i) => { if (!seen.has(i + 1) && !exclude.has(p.id) && photos.length <= 12) rows.push({ photo_id: p.id, role: "keep", reason: "No strong reason to move it." }); });
  // Exactly one lead, first; then keepers; drops last. The model's own order is kept within each group.
  let lead = rows.findIndex((r) => r.role === "lead");
  if (lead < 0) lead = rows.findIndex((r) => r.role === "keep");
  if (lead < 0) return null;
  const order = rows.map((r, i) => ({ ...r, role: i === lead ? ("lead" as const) : r.role === "lead" ? ("keep" as const) : r.role }));
  const rank = { lead: 0, keep: 1, drop: 2 } as const;
  order.sort((a, b) => rank[a.role] - rank[b.role]);
  const add = (Array.isArray(json.add) ? json.add : []).map((a) => stripEmoji(String(a)).slice(0, 160).trim()).filter((a) => a && !UNSAFE.test(a)).slice(0, 3);
  return { kind: "ranked", order, add };
}

export function photoChecklist(note?: string): PhotoSection {
  return { kind: "checklist", items: PHOTO_CHECKLIST, ...(note ? { note } : {}) };
}
