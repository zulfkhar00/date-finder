// The account kit: what an operator types into each dating app for one client, built from onboarding + the starter pack and cut to
// each app's real limits. Pure (no I/O, no server-only), tested by scripts/check-operator.mts. Nothing here calls a model: the
// pack already holds the writing; the kit fits it to the app, orders the photos, and turns preferences into filter values.
import type { App } from "@/lib/app/domain";
import type { PackContent } from "@/lib/starter-pack/types";

export const KIT_SECTIONS = ["bio", "prompts", "photos", "filters", "tone", "dealbreakers", "schedule"] as const;
export type KitSection = (typeof KIT_SECTIONS)[number];
export const SECTION_LABELS: Record<KitSection, string> = {
  bio: "Bio", prompts: "Prompts", photos: "Photos", filters: "Filters", tone: "Opener and reply tone", dealbreakers: "Dealbreakers", schedule: "Date windows"
};

/** Real field limits per app. Hinge has three prompt answers (150 each) and no long bio; Tinder 500; Bumble 300. */
export type AppLimits = { bio: number; promptAnswer: number; prompts: number; photos: number };
export const APP_LIMITS: Record<App, AppLimits> = {
  tinder: { bio: 500, promptAnswer: 0, prompts: 0, photos: 9 },
  hinge: { bio: 150, promptAnswer: 150, prompts: 3, photos: 6 },
  bumble: { bio: 300, promptAnswer: 300, prompts: 3, photos: 6 }
};

/** Cuts text to at most `max` characters: whole sentences if one fits, else whole words. Never returns more than max. */
export function fitText(input: string, max: number): { text: string; clipped: boolean } {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return { text, clipped: false };
  const head = text.slice(0, max);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentence >= Math.floor(max * 0.5)) return { text: head.slice(0, sentence + 1).trim(), clipped: true };
  const space = head.lastIndexOf(" ");
  const words = (space > 0 ? head.slice(0, space) : head).replace(/[\s,;:\-–—]+$/, "");
  return { text: words, clipped: true };
}

export type KitInput = {
  app: App;
  profile: { first_name: string | null; gender: string | null; interested_in: string[] | null; voice: string | null; city: string | null };
  prefs: { age_min: number | null; age_max: number | null; distance_km: number | null; looking_for: string | null; dealbreakers: string[] | null } | null;
  pack: PackContent | null;
  /** Live (not removed) photos in the client's own order; `flagged` ones are held back for review and never used. */
  photos: { id: string; position: number; flagged: boolean }[];
};

export type KitSections = {
  bio: { text: string | null; limit: number; length: number; clipped: boolean; source: "app" | "general" | "none" };
  prompts: { limit: number; max: number; items: { prompt: string; answer: string; clipped: boolean }[] };
  photos: { max: number; items: { photoId: string; role: "lead" | "keep" | "fill" }[]; skippedFlagged: number; note: string | null };
  filters: { ageMin: number | null; ageMax: number | null; distanceKm: number | null; distanceMiles: number | null; show: "men" | "women" | "everyone" | null; lookingFor: string | null };
  tone: { voice: string; guide: string; openers: string[]; replies: { situation: string; template: string }[] };
  dealbreakers: { items: string[] };
  schedule: { windows: { days: string; start: string; end: string }[]; plan: string | null; budget: string | null; venues: string[] };
};

const VOICE_GUIDE: Record<string, string> = {
  warm: "Warm and easy: friendly, a little curious, never needy. Short messages, one question at a time.",
  playful: "Playful: light teasing, a joke when it fits, still kind. Never sarcastic about her.",
  direct: "Direct: clear and confident, short sentences, suggest a plan early. No filler."
};

export function buildBio(input: KitInput): KitSections["bio"] {
  const limit = APP_LIMITS[input.app].bio;
  const entry = input.pack?.profiles.find((p) => p.app === input.app);
  const fallback = entry ? null : input.pack?.profiles.find((p) => p.app === "general");
  const picked = entry ?? fallback;
  if (!picked) return { text: null, limit, length: 0, clipped: false, source: "none" };
  const fit = fitText(picked.bio, limit);
  return { text: fit.text, limit, length: fit.text.length, clipped: fit.clipped, source: entry ? "app" : "general" };
}

export function buildPrompts(input: KitInput): KitSections["prompts"] {
  const lim = APP_LIMITS[input.app];
  const entry = input.pack?.profiles.find((p) => p.app === input.app) ?? input.pack?.profiles.find((p) => p.app === "general");
  const items = lim.prompts ? (entry?.prompts ?? []).slice(0, lim.prompts).map((p) => {
    const fit = fitText(p.answer, lim.promptAnswer);
    return { prompt: p.prompt.trim(), answer: fit.text, clipped: fit.clipped };
  }) : [];
  return { limit: lim.promptAnswer, max: lim.prompts, items };
}

/** Photo set in order: the pack's ranking (lead first, drops left out) when it has one, else the client's own order. Flagged photos never appear. */
export function buildPhotos(input: KitInput): KitSections["photos"] {
  const max = APP_LIMITS[input.app].photos;
  const usable = [...input.photos].sort((a, b) => a.position - b.position);
  const flagged = usable.filter((p) => p.flagged).length;
  const live = usable.filter((p) => !p.flagged);
  const liveIds = new Set(live.map((p) => p.id));
  const ordered: { photoId: string; role: "lead" | "keep" | "fill" }[] = [];
  const seen = new Set<string>();
  const ranking = input.pack?.photos.kind === "ranked" ? input.pack.photos : null;
  const dropped = new Set((ranking?.order ?? []).filter((o) => o.role === "drop").map((o) => o.photo_id));
  for (const o of ranking?.order ?? []) {
    if (o.role === "drop" || !liveIds.has(o.photo_id) || seen.has(o.photo_id)) continue;
    seen.add(o.photo_id);
    ordered.push({ photoId: o.photo_id, role: o.role });
  }
  const ranked = ordered.length > 0;
  for (const p of live) if (!seen.has(p.id) && !dropped.has(p.id) && (!ranked || ordered.length < max)) { seen.add(p.id); ordered.push({ photoId: p.id, role: ranked ? "fill" : ordered.length === 0 ? "lead" : "keep" }); }
  const items = ordered.slice(0, max);
  const note = items.length === 0 ? "No usable photos. Ask the client for more (Needs you: photos)." : items.length < 3 ? "Fewer than 3 usable photos. Ask the client for more before uploading." : null;
  return { max, items, skippedFlagged: flagged, note };
}

export function buildFilters(input: KitInput): KitSections["filters"] {
  const into = new Set(input.profile.interested_in ?? []);
  const show = into.has("man") && into.has("woman") ? "everyone" : into.has("woman") ? "women" : into.has("man") ? "men" : into.size ? "everyone" : null;
  const km = input.prefs?.distance_km ?? null;
  return {
    ageMin: input.prefs?.age_min ?? null, ageMax: input.prefs?.age_max ?? null, distanceKm: km, distanceMiles: km === null ? null : Math.max(1, Math.round(km / 1.609)),
    show, lookingFor: input.prefs?.looking_for ?? null
  };
}

export function buildTone(input: KitInput): KitSections["tone"] {
  const voice = input.profile.voice && VOICE_GUIDE[input.profile.voice] ? input.profile.voice : "warm";
  return {
    voice, guide: `${VOICE_GUIDE[voice]} Write as him, first person, in his voice. Never mention NoSwipe or AI.`,
    openers: (input.pack?.openers ?? []).map((o) => o.line), replies: (input.pack?.replies ?? []).map((r) => ({ situation: r.situation, template: r.template }))
  };
}

export function buildDealbreakers(input: KitInput): KitSections["dealbreakers"] {
  return { items: [...new Set((input.prefs?.dealbreakers ?? []).map((d) => d.trim()).filter(Boolean))] };
}

/** Default windows are evenings Thursday to Saturday and a Sunday afternoon; the pack's own suggestion rides along as text. */
export function buildSchedule(input: KitInput): KitSections["schedule"] {
  const plan = input.pack?.datePlan;
  return {
    windows: [{ days: "Thu-Sat", start: "18:00", end: "21:00" }, { days: "Sun", start: "11:00", end: "15:00" }],
    plan: plan ? `${plan.headline}. ${plan.when}` : null, budget: plan?.budget ?? null, venues: (plan?.venues ?? []).map((v) => v.type)
  };
}

export function buildSection(section: KitSection, input: KitInput): KitSections[KitSection] {
  switch (section) {
    case "bio": return buildBio(input);
    case "prompts": return buildPrompts(input);
    case "photos": return buildPhotos(input);
    case "filters": return buildFilters(input);
    case "tone": return buildTone(input);
    case "dealbreakers": return buildDealbreakers(input);
    case "schedule": return buildSchedule(input);
  }
}

export function buildKit(input: KitInput): KitSections {
  return Object.fromEntries(KIT_SECTIONS.map((s) => [s, buildSection(s, input)])) as unknown as KitSections;
}

export function isKitSection(value: unknown): value is KitSection {
  return typeof value === "string" && (KIT_SECTIONS as readonly string[]).includes(value);
}

/** Plain text of one section, for the Copy button. */
export function sectionText(section: KitSection, kit: KitSections): string {
  switch (section) {
    case "bio": return kit.bio.text ?? "";
    case "prompts": return kit.prompts.items.map((p) => `${p.prompt}\n${p.answer}`).join("\n\n");
    case "photos": return kit.photos.items.map((p, i) => `${i + 1}. ${p.role}`).join("\n");
    case "filters": { const f = kit.filters; return [`Show me: ${f.show ?? "not set"}`, `Age: ${f.ageMin ?? "?"} to ${f.ageMax ?? "?"}`, `Distance: ${f.distanceKm ?? "?"} km (${f.distanceMiles ?? "?"} mi)`].join("\n"); }
    case "tone": return [kit.tone.guide, "", "Openers:", ...kit.tone.openers.map((o) => `- ${o}`), "", "Replies:", ...kit.tone.replies.map((r) => `- ${r.situation}: ${r.template}`)].join("\n");
    case "dealbreakers": return kit.dealbreakers.items.map((d) => `- ${d}`).join("\n");
    case "schedule": return [...kit.schedule.windows.map((w) => `${w.days} ${w.start}-${w.end}`), kit.schedule.plan ?? "", kit.schedule.budget ? `Budget: ${kit.schedule.budget}` : ""].filter(Boolean).join("\n");
  }
}

// --- time zones -------------------------------------------------------------------------------------------------

export function isValidTimezone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** "18:00" on `day` (YYYY-MM-DD) in zone `from`, written as HH:MM in zone `to`. Handles DST by asking Intl for the offset on that day. */
export function convertClock(hhmm: string, day: string, from: string, to: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), h, m);
  const offset = (tz: string, at: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - at;
  };
  const instant = guess - offset(from, guess - offset(from, guess));
  return new Intl.DateTimeFormat("en-GB", { timeZone: to, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).format(new Date(instant));
}
