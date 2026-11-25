// Live demo mode, the rules. Pure: no I/O, no clock reads (callers pass `nowMs` and `rng`), so scripts/check-demo-live.mts drives every
// branch. The service (service.ts) does the database and model calls around these decisions.
import { PERSONAS, VENUES, type Persona } from "./personas";

/** The most the demo may spend on the model per UTC day, in millionths of a dollar ($0.50). At the cap every line is canned. */
export const DAILY_CAP_MICRO = 500_000;
/** Stand-in price used to meter spend: $3 per million input tokens, $15 per million output (millionths of a dollar per token). */
export const MICRO_PER_INPUT_TOKEN = 3;
export const MICRO_PER_OUTPUT_TOKEN = 15;
export const costMicro = (inputTokens: number, outputTokens: number): number =>
  Math.max(0, Math.round(inputTokens)) * MICRO_PER_INPUT_TOKEN + Math.max(0, Math.round(outputTokens)) * MICRO_PER_OUTPUT_TOKEN;

/** Tick pacing: one action no sooner than 9 s after the last, usually within ~25 s. */
export const MIN_GAP_MS = 9_000;
export const MAX_GAP_MS = 26_000;
export const nextGapMs = (rng: () => number): number => Math.round(MIN_GAP_MS + rng() * (MAX_GAP_MS - MIN_GAP_MS));
/** A tick holds the lock this long at most; a crashed tick frees itself. */
export const LOCK_MS = 25_000;

// ---------- who says what ----------

export type TurnKind = "chat" | "propose" | "confirm" | "close";
export type TurnSender = "match" | "as_user_ai";

export function turnSender(p: Persona, index: number): TurnSender {
  const herTurn = p.opener === "her" ? index % 2 === 0 : index % 2 === 1;
  return herTurn ? "match" : "as_user_ai";
}
export function turnKind(p: Persona, index: number): TurnKind {
  const left = p.script.length - index;
  return left === 3 ? "propose" : left === 2 ? "confirm" : left === 1 ? "close" : "chat";
}
export const personaBySlug = (slug: string): Persona | undefined => PERSONAS.find((p) => p.slug === slug);

// ---------- hashing, time zones, the planned date ----------

export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

function zoneParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
}
function offsetMs(ms: number, timeZone: string): number {
  const p = zoneParts(ms, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant at which the wall clock in `timeZone` reads y-mo-d h:mi (DST-safe: re-checks the offset at the answer). */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - offsetMs(guess, timeZone);
  return guess - offsetMs(first, timeZone);
}

export type DatePlan = { startsAt: string; day: string; time: string; venue: string; address: string; kind: string };

const SLOTS: readonly [number, number][] = [[19, 0], [19, 30], [18, 30], [20, 0], [12, 30], [17, 30], [19, 0], [20, 0]];

/**
 * The one date a chat will end in, a pure function of the match and the zone: 2 to 5 days after the match, at a plausible hour, at an
 * invented venue. The proposal line and the booked row both call this, so "Thursday at 7pm at X" in the chat is the date in Dates.
 */
export function planDate(matchId: string, matchedAtMs: number, timeZone: string, city: string | null): DatePlan {
  const h = hash32(matchId);
  const base = zoneParts(matchedAtMs, timeZone);
  const ahead = 2 + (h % 4);
  const dayUtc = new Date(Date.UTC(base.y, base.mo - 1, base.d + ahead));
  const [hour, minute] = SLOTS[(h >>> 4) % SLOTS.length];
  const startMs = zonedToUtc(dayUtc.getUTCFullYear(), dayUtc.getUTCMonth() + 1, dayUtc.getUTCDate(), hour, minute, timeZone);
  const venue = VENUES[(h >>> 9) % VENUES.length];
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(startMs);
  const time = `${hour % 12 === 0 ? 12 : hour % 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour >= 12 ? "pm" : "am"}`;
  return { startsAt: new Date(startMs).toISOString(), day, time, venue: venue.name, kind: venue.kind, address: city ? `${city} city centre` : "Near the city centre" };
}

export function fillLine(template: string, plan: Pick<DatePlan, "day" | "time" | "venue">): string {
  return template.replaceAll("{day}", plan.day).replaceAll("{time}", plan.time).replaceAll("{venue}", plan.venue);
}

// ---------- model output hygiene ----------

const BANNED = /(\bAI\b|\bA\.I\.|noswipe|assistant|language model|chatbot|\bbot\b|as an? (ai|assistant)|https?:|www\.|@\w|\b\d{3}[ .-]?\d{3}[ .-]?\d{4}\b|fuck|shit|sex|nude|naked|dick|cock|pussy|horny|hookup|tits|boob|porn|kill|suicide|nazi)/i;

/**
 * One chat line from the model, or null when it is not fit to show: empty, too long, several paragraphs, a bot tell, contact details,
 * explicit words, or (for a proposal) it never names the venue the date will be booked at.
 */
export function cleanLine(raw: string, ctx: { kind: TurnKind; venue: string }): string | null {
  let t = raw.replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "").replace(/^(him|her|me)\s*:\s*/i, "").trim();
  if (!t || t.length < 2 || t.length > 260) return null;
  if (/\n\s*\n/.test(t) || t.split("\n").length > 2) return null;
  t = t.replace(/\s*\n\s*/g, " ");
  if (BANNED.test(t)) return null;
  if ((t.match(/\p{Extended_Pictographic}/gu) ?? []).length > 2) return null;
  if (ctx.kind === "propose" && !t.toLowerCase().includes(ctx.venue.toLowerCase())) return null;
  return t;
}

// ---------- what to do on a tick ----------

export type ChatState = { matchId: string; slug: string; turns: number; lastAtMs: number; booked: boolean; takenOver: boolean };
export type TickInput = { nowMs: number; chats: readonly ChatState[]; usedSlugs: ReadonlySet<string>; lastMatchAtMs: number };
export type Action =
  | { kind: "turn"; matchId: string; slug: string; index: number }
  | { kind: "book"; matchId: string; slug: string }
  | { kind: "match"; slug: string }
  | { kind: "swipes"; count: number }
  | { kind: "idle" };

const TURN_DELAY_MS = { match: 16_000, as_user_ai: 7_000 } as const;
const BOOK_DELAY_MS = 5_000;
const MATCH_GAP_MS = 50_000;

export function nextPersona(used: ReadonlySet<string>): Persona | null {
  return PERSONAS.find((p) => !used.has(p.slug)) ?? null;
}

/**
 * One thing per tick. A finished chat gets its date first; otherwise a weighted pick between the next line in a chat (whoever is due),
 * a new match (not more often than every 50 s, until the personas run out) and a batch of swipes. Chats the user took over are left alone.
 */
export function chooseAction(input: TickInput, rng: () => number): Action {
  const { nowMs } = input;
  for (const c of input.chats) {
    const p = personaBySlug(c.slug);
    if (p && !c.takenOver && !c.booked && c.turns >= p.script.length && nowMs - c.lastAtMs >= BOOK_DELAY_MS) return { kind: "book", matchId: c.matchId, slug: c.slug };
  }
  const options: { weight: number; action: Action }[] = [];
  for (const c of input.chats) {
    const p = personaBySlug(c.slug);
    if (!p || c.takenOver || c.turns >= p.script.length) continue;
    if (nowMs - c.lastAtMs < TURN_DELAY_MS[turnSender(p, c.turns)]) continue;
    options.push({ weight: 6, action: { kind: "turn", matchId: c.matchId, slug: c.slug, index: c.turns } });
  }
  const next = nextPersona(input.usedSlugs);
  if (next && nowMs - input.lastMatchAtMs >= MATCH_GAP_MS) options.push({ weight: options.length ? 3 : 8, action: { kind: "match", slug: next.slug } });
  options.push({ weight: options.length > 1 ? 1.5 : 4, action: { kind: "swipes", count: 5 + Math.floor(rng() * 15) } });
  const total = options.reduce((n, o) => n + o.weight, 0);
  let roll = rng() * total;
  for (const o of options) { roll -= o.weight; if (roll <= 0) return o.action; }
  return options[options.length - 1].action;
}

// ---------- the starting state ----------

/** Chats the demo starts with, so Home is already busy when the page opens. `turns` = lines already sent; ages are minutes before now. */
export const SEED: readonly { slug: string; turns: number | "all"; matchedAgoMin: number; lastAgoMin: number; unread?: true }[] = [
  { slug: "jess", turns: "all", matchedAgoMin: 4 * 1440, lastAgoMin: 3.1 * 1440 },
  { slug: "sophie", turns: "all", matchedAgoMin: 2.2 * 1440, lastAgoMin: 1.6 * 1440 },
  { slug: "maya", turns: "all", matchedAgoMin: 27 * 60, lastAgoMin: 3 * 60 },
  { slug: "camila", turns: 6, matchedAgoMin: 30 * 60, lastAgoMin: 20 * 60 },
  { slug: "priya", turns: 5, matchedAgoMin: 9 * 60, lastAgoMin: 70 },
  { slug: "chloe", turns: 3, matchedAgoMin: 5 * 60, lastAgoMin: 38, unread: true },
  { slug: "zoe", turns: 4, matchedAgoMin: 3.5 * 60, lastAgoMin: 22, unread: true },
  { slug: "hannah", turns: 1, matchedAgoMin: 100, lastAgoMin: 14, unread: true },
  { slug: "amara", turns: 2, matchedAgoMin: 55, lastAgoMin: 8, unread: true },
  { slug: "leila", turns: 0, matchedAgoMin: 6, lastAgoMin: 6 }
];

/** Times for a seeded chat: the match, then `turns` lines spread evenly up to `lastAgoMin` before now. */
export function seedTimes(spec: (typeof SEED)[number], scriptLength: number, nowMs: number, rng: () => number): { matchedAtMs: number; lineAtMs: number[] } {
  const turns = spec.turns === "all" ? scriptLength : spec.turns;
  const matchedAtMs = nowMs - spec.matchedAgoMin * 60_000;
  const lastMs = nowMs - spec.lastAgoMin * 60_000;
  const lineAtMs: number[] = [];
  for (let i = 0; i < turns; i++) {
    const frac = turns === 1 ? 1 : (i + 1) / turns;
    const jitter = (rng() - 0.5) * 0.4 * ((lastMs - matchedAtMs) / Math.max(turns, 1));
    lineAtMs.push(Math.round(Math.min(lastMs, matchedAtMs + 90_000 + (lastMs - matchedAtMs - 90_000) * frac + (i === turns - 1 ? 0 : jitter))));
  }
  for (let i = 1; i < lineAtMs.length; i++) if (lineAtMs[i] <= lineAtMs[i - 1]) lineAtMs[i] = lineAtMs[i - 1] + 20_000;
  return { matchedAtMs, lineAtMs };
}
