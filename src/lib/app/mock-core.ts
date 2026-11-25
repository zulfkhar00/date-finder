// State and rules for the owner-only product walkthrough at /app. Everything is invented sample data and everything
// lives in the browser (localStorage): no Supabase, no real client rows, nothing is sent anywhere. Pure functions, no
// window access, so scripts/check-mock.ts can run them. Matches only ever see ordinary texting from the user, so no
// message here mentions NoSwipe, AI or bots.
import { APPS, encodeSystemEvent, splitDates, stepSchemas, type App, type AppAccountRow, type ChatMode, type DateRow, type Sender, type StepName } from "@/lib/app/domain";
import type { ChatSummary, Photo } from "@/lib/app/data";
import type { Draft } from "@/lib/app/draft";

export const MOCK_VERSION = 1;
const MIN = 60_000, HOUR = 3_600_000, DAY = 24 * HOUR;
export const REPLY_DELAY_MS = 3500;
export const MAX_MESSAGE = 4000;

export type MockMsg = { id: string; sender: Sender; body: string; sent_at: string };
export type MockDraft = { options: string[]; i: number };
export type ScriptStep = { reply: string; drafts: string[] };
export type MockMatch = {
  id: string; app: App; name: string; age: number | null; photoUrl: string | null; matched_at: string;
  mode: ChatMode; needs_user: boolean; needs_reason: string | null;
  messages: MockMsg[]; draft: MockDraft | null; script: ScriptStep[]; scriptIdx: number; pendingReplyAt: string | null; seq: number;
};
export type DateStatus = "proposed" | "booked" | "cancelled";
export type DateOutcome = "great" | "fine" | "nope";
export type MockDate = {
  id: string; match_id: string | null; who: string; venue: string; address: string | null; starts_at: string; summary: string | null;
  status: DateStatus; slots: string[]; outcome: DateOutcome | null;
};
export type MockProfile = Draft & { email: string; voice: string; notifyEmail: boolean };
export type MockState = {
  v: typeof MOCK_VERSION;
  onboarding: { done: boolean; step: number };
  profile: MockProfile; photos: Photo[]; apps: AppAccountRow[];
  matches: MockMatch[]; dates: MockDate[]; matchesThisWeek: number;
};

export const SAMPLE_PHOTOS: Photo[] = [1, 2, 3].map((n) => ({ id: `alex-${n}`, path: `demo/alex-${n}`, position: n - 1, url: `/demo/alex-${n}.jpg` }));

const GENERIC_DRAFTS = [
  "haha ok fair, tell me more about that",
  "ok now I'm curious, what's the story there?",
  "that made me laugh. so what are you up to this weekend?"
];

/** A local wall-clock time `days` from now, so dates read right in the viewer's own time zone. */
function inDays(now: number, days: number, hour: number, minute = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function build(now: number, id: string, spec: Omit<MockMatch, "id" | "messages" | "seq" | "pendingReplyAt" | "scriptIdx" | "matched_at"> & { matchedAgo: number; scriptIdx?: number }, lines: [Sender, string, number][]): MockMatch {
  const { matchedAgo, scriptIdx, ...rest } = spec;
  const messages = lines.map(([sender, body, minsAgo], n) => ({ id: `${id}-${n + 1}`, sender, body, sent_at: new Date(now - minsAgo * MIN).toISOString() }));
  return { ...rest, id, matched_at: new Date(now - matchedAgo).toISOString(), messages, scriptIdx: scriptIdx ?? 0, pendingReplyAt: null, seq: messages.length };
}

/** Thirty-odd messages over several days, to see a long thread scroll, day dividers and all. */
function longThread(): [Sender, string, number][] {
  const lines: [Sender, string][] = [
    ["match", "ok your ramen opinion is bold. broth first or noodles first"],
    ["as_user_ai", "broth first, always. it's the only honest way to start"],
    ["match", "ha. noodles first, I want to see what I'm getting into"],
    ["as_user_ai", "that explains a lot about your hinge prompt"],
    ["match", "my prompt is a masterpiece and you know it"],
    ["as_user_ai", "it is. 'will trade a bad pun for a good restaurant rec' is hard to beat"],
    ["match", "ok so rec me something then"],
    ["as_user_ai", "there's a tiny place on Harbor St, six stools, the owner yells your order at the kitchen. best tonkotsu I've had"],
    ["match", "six stools?? I'm in. when"],
    ["as_user_ai", "I'm free tomorrow night if you are"],
    ["match", "that works. 7:30?"],
    ["as_user_ai", "7:30 it is. I'll put my name down early, they only do walk-ins after 8"],
    ["match", "you're a planner, I like that"],
    ["as_user_ai", "only for ramen. everything else is chaos"],
    ["match", "perfect we can be chaos together 😂"],
    ["as_user_ai", "deal. see you then"],
    ["match", "just parked, I'm the one in the green coat"],
    ["as_user_ai", "wave at me, I'm already at the counter"],
    ["match", "had a really good time last night. thank you for the broth lecture"],
    ["as_user_ai", "me too, honestly. you were right about the noodles"],
    ["match", "told you. same again soon? my turn to pick the place"],
    ["as_user_ai", "yes please. pick somewhere I'd never find on my own"],
    ["match", "challenge accepted. thursday?"],
    ["as_user_ai", "thursday works, send me the address when you've picked"],
    ["match", "will do. don't eat before 🙂"]
  ];
  // Spread from five days ago to this morning, slightly bunched, oldest first.
  return lines.map(([sender, body], n) => [sender, body, Math.round((lines.length - n) * (7000 / lines.length))]);
}

/** The next given weekday (0 = Sunday) at least a day away, at a local hour, so "Thursday" in a chat is a Thursday on the Dates tab. */
function nextWeekday(now: number, weekday: number, hour: number, minute = 0): string {
  const ahead = (weekday - new Date(now).getDay() + 7) % 7 || 7;
  return inDays(now, ahead, hour, minute);
}

export function seed(now = Date.now()): MockState {
  const thu = nextWeekday(now, 4, 19), sat = nextWeekday(now, 6, 11), sun = nextWeekday(now, 0, 11);
  const matches: MockMatch[] = [
    build(now, "priya", {
      app: "hinge", name: "Priya", age: 29, photoUrl: null, matchedAgo: 3 * DAY, mode: "ai", needs_user: true, needs_reason: "Priya said yes to Sunday",
      draft: { options: [
        "perfect, there's a little roastery near the park with a ridiculous almond croissant. 11? I'll grab the table by the window",
        "yes!! I know exactly where, the croissants there are dangerous. sunday at 11, I'll save us a spot"
      ], i: 0 },
      script: [{ reply: "see you then! I'll be the one with the sleepy eyes and the bad bangs photo 😂", drafts: ["can't wait. I'll bring the receipts for the haircut story", "haha deal, bangs photo vs the barber photo, winner buys"] }]
    }, [
      ["match", "your answer about the worst haircut of your life is the best thing I've read on here", 3 * 24 * 60 - 20],
      ["as_user_ai", "ha, in my defense the barber said 'trust me' and then did not deserve it. yours?", 3 * 24 * 60 - 26],
      ["match", "I once let my roommate cut my bangs at 2am. no regrets, many regrets", 2 * 24 * 60 + 300],
      ["as_user_ai", "ok that's a commitment I respect. we should compare photos over coffee, I'm free sunday morning", 2 * 24 * 60 + 296],
      ["match", "sunday morning works! somewhere with good pastries", 95]
    ]),
    build(now, "jess", {
      app: "tinder", name: "Jess", age: 30, photoUrl: "/demo/jess.jpg", matchedAgo: 6 * HOUR, mode: "ai", needs_user: true, needs_reason: "Jess asked to move to WhatsApp",
      draft: { options: [
        "haha brother noted. whatsapp's fine, but I'd honestly rather just meet up first. I'm free tomorrow evening, drinks somewhere low key?",
        "ok good, I was worried about the guy in the background. happy to switch to whatsapp, but let's pick a day to meet first so we're not texting forever"
      ], i: 0 },
      script: [{ reply: "tomorrow works!! somewhere with outdoor seating if possible", drafts: ["outdoor seating, noted. there's a rooftop place I've been meaning to try, 7:30?", "done, I know a patio spot that's good for people-watching. 7:30?"] }]
    }, [
      ["as_user_ai", "ok I have to ask, is the climbing gym photo from this year or 2019 Jess", 300],
      ["match", "lol 2023, i'm slower now", 288],
      ["as_user_ai", "slower than me is still faster than the guy in the background", 290 - 40],
      ["match", "ok that's my brother. also is it ok if we move to whatsapp?", 40]
    ]),
    build(now, "maya", {
      app: "hinge", name: "Maya", age: 28, photoUrl: "/demo/maya.jpg", matchedAgo: 3 * DAY, mode: "ai", needs_user: false, needs_reason: null, draft: null,
      script: [{ reply: "heads up I might be 5 min late, parking there is a nightmare", drafts: ["no stress at all, I'll grab us a table and a basket of chips 🙂", "haha all good, I'll be the one hiding behind a menu"] }]
    }, [
      ["match", "ok so the trail story. did you actually fall in the creek or is that embellished", 2 * 24 * 60 + 180],
      ["as_user_ai", "haha fully fell in. my dog just stood there judging me", 2 * 24 * 60 + 176],
      ["match", "ok you win. want to grab food this week? i'm thinking mexican", 2 * 24 * 60 + 120],
      ["as_user_ai", "oh yesss that would be cool, i love mexican food, there's a taco place on 5th that's amazing, thursday?", 2 * 24 * 60 + 117],
      ["match", "Thursday works! 7?", 2 * 24 * 60 + 60],
      ["as_user_ai", "perfect, see you there 🙂", 2 * 24 * 60 + 58],
      ["system_internal", encodeSystemEvent({ kind: "date_booked", startsAt: thu, venue: "Taco place on 5th" }), 2 * 24 * 60 + 57]
    ]),
    build(now, "lin", {
      app: "bumble", name: "Lin", age: 27, photoUrl: "/demo/lin.jpg", matchedAgo: DAY + 4 * HOUR, mode: "user", needs_user: false, needs_reason: null, draft: null,
      script: [{ reply: "lol ok the pecorino story is exactly what I needed today. and then??", drafts: [] }, { reply: "you're dangerous. saturday still good for coffee?", drafts: [] }]
    }, [
      ["match", "your bio says you make pasta from scratch. prove it", 20 * 60],
      ["as_user_ai", "challenge accepted. i make a mean cacio e pepe, ask me about the time the pecorino exploded", 20 * 60 - 6],
      ["match", "ok now I need the story", 180],
      ["system_internal", encodeSystemEvent({ kind: "took_over" }), 160],
      ["user", "ok so picture this. 8pm, tiny apartment, one very sad block of pecorino", 150]
    ]),
    build(now, "chloe", {
      app: "tinder", name: "Chloe", age: 26, photoUrl: null, matchedAgo: 25 * MIN, mode: "ai", needs_user: true, needs_reason: "First message ready to review",
      draft: { options: [
        "ok I have to ask, is the dog in photo 3 yours or are you a professional dog borrower",
        "your dog has better posture than me. does he do group walks or is he exclusive",
        "photo 4 is the best photo on here and I'll fight anyone who says otherwise. where was that?"
      ], i: 0 },
      script: [
        { reply: "haha mine, his name is Waffles and he's extremely exclusive", drafts: ["Waffles. ok that's the best dog name I've heard all year. does he approve of new people or do I need a reference", "respect to Waffles. is he a morning walk guy or a sunset walk guy"] },
        { reply: "morning, he wakes me up at 6 like a tiny alarm clock", drafts: ["6am is brutal but also adorable. I'd take him for a walk before coffee if he lets me in the club", "ok that's a good alarm clock. want to introduce me properly? coffee and a walk this weekend?"] }
      ]
    }, []),
    build(now, "alexandria", {
      app: "bumble", name: "Alexandria-Rose Montgomery-Whitfield", age: 33, photoUrl: null, matchedAgo: 2 * DAY, mode: "ai", needs_user: false, needs_reason: null, draft: null,
      script: [{ reply: "sorry for the slow reply, work has been chaos! how's your week going?", drafts: ["no worries at all, mine's been a lot too. what's the chaos, anything fun or just emails?", "all good! my week's been fine, better now. what do you do that's keeping you so busy?"] }]
    }, [
      ["match", "Hi! 👋", 2 * 24 * 60],
      ["as_user_ai", "hey! love the photo at the lake, was that a hike or did you just get lucky with the view", 2 * 24 * 60 - 4]
    ]),
    build(now, "dana", {
      app: "hinge", name: "Dana", age: 31, photoUrl: null, matchedAgo: 8 * DAY, mode: "ai", needs_user: false, needs_reason: null, draft: null,
      script: [{ reply: "just got your text, thursday works great", drafts: [] }]
    }, longThread())
  ];
  // The chat list sorts by the last message, so keep them in the order the app would show.
  const dates: MockDate[] = [
    { id: "d-priya", match_id: "priya", who: "Priya", venue: "Linden Roastery", address: "14 Linden Row", starts_at: sun, summary: "The 2am bangs story and a shared weakness for almond croissants.", status: "proposed", slots: [nextWeekday(now, 0, 10), nextWeekday(now, 0, 12, 30), nextWeekday(now, 6, 17)], outcome: null },
    { id: "d-maya", match_id: "maya", who: "Maya", venue: "Taco place on 5th", address: "512 5th St", starts_at: thu, summary: "The creek story, her dog, and a shared love of mexican food.", status: "booked", slots: [], outcome: null },
    { id: "d-lin", match_id: "lin", who: "Lin", venue: "Little Owl Coffee", address: "66 Mint St", starts_at: sat, summary: "Pasta from scratch, and the great pecorino incident.", status: "booked", slots: [], outcome: null },
    { id: "d-dana", match_id: "dana", who: "Dana", venue: "Harbor Street Ramen", address: "9 Harbor St", starts_at: inDays(now, -1, 19, 30), summary: "Broth first versus noodles first, settled in the end.", status: "booked", slots: [], outcome: null },
    { id: "d-noor", match_id: null, who: "Noor", venue: "Greenhouse Cafe", address: null, starts_at: inDays(now, -9, 16), summary: null, status: "booked", slots: [], outcome: "fine" },
    { id: "d-sam", match_id: null, who: "Sam", venue: "Riverside Bar", address: "2 River Walk", starts_at: inDays(now, -15, 20), summary: "Plans fell through on her side.", status: "cancelled", slots: [], outcome: null }
  ];
  return {
    v: MOCK_VERSION, onboarding: { done: true, step: 0 },
    profile: {
      firstName: "Alex", birthday: "1996-05-14", gender: "man", interestedIn: ["women"], job: "Product designer", heightCm: "180", interests: ["Hiking", "Cooking", "Live music"],
      city: "Austin", ageMin: "25", ageMax: "33", distanceKm: "50", lookingFor: "meaningful", dealbreakers: ["Smokes", "Rude to waiters", "No sense of humor"], apps: ["tinder", "hinge", "bumble"],
      email: "alex@example.com", voice: "warm", notifyEmail: true
    },
    photos: SAMPLE_PHOTOS,
    apps: APPS.map((app) => ({ app, status: "active", user_paused: false })),
    matches, dates, matchesThisWeek: 14
  };
}

/** A person who has just signed up: nothing yet. Used for the empty states and to replay onboarding. */
export function fresh(): MockState {
  return {
    v: MOCK_VERSION, onboarding: { done: false, step: 0 },
    profile: { firstName: "", birthday: "", gender: "", interestedIn: [], job: "", heightCm: "", interests: ["", "", ""], city: "", ageMin: "", ageMax: "", distanceKm: "50", lookingFor: "", dealbreakers: ["", "", ""], apps: [], email: "alex@example.com", voice: "warm", notifyEmail: true },
    photos: [], apps: [], matches: [], dates: [], matchesThisWeek: 0
  };
}

/** The empty-state tour: a finished profile with the apps set up, but no matches or dates yet. */
export function quiet(now = Date.now()): MockState {
  const s = seed(now);
  return { ...s, apps: s.apps.map((a) => ({ ...a, status: "setting_up" })), matches: [], dates: [], matchesThisWeek: 0 };
}

// --- derived views ------------------------------------------------------------------------------

export const realMessages = (m: MockMatch) => m.messages.filter((x) => x.sender !== "system_internal");
export const lastReal = (m: MockMatch): MockMsg | null => realMessages(m).at(-1) ?? null;
const byTime = (m: MockMatch) => Date.parse(lastReal(m)?.sent_at ?? m.matched_at);

export function chatSummaries(s: MockState): ChatSummary[] {
  return [...s.matches].sort((a, b) => byTime(b) - byTime(a)).map((m) => {
    const last = lastReal(m);
    const acc = s.apps.find((a) => a.app === m.app);
    return {
      id: m.id, app: m.app, name: m.name, age: m.age, photo_path: null, matched_at: m.matched_at, needs_user: m.needs_user, needs_reason: m.needs_reason,
      photoUrl: m.photoUrl, last: last ? { ...last, match_id: m.id } : null, mode: m.mode, paused: Boolean(acc?.user_paused || acc?.status === "paused" || acc?.status === "closed")
    };
  });
}
export const needsYouChats = (s: MockState) => chatSummaries(s).filter((c) => c.needs_user && c.mode === "ai");
export const dateRows = (s: MockState): (DateRow & { match_id: string | null })[] =>
  s.dates.map((d) => ({ id: d.id, who: d.who, venue: d.venue, address: d.address, starts_at: d.starts_at, summary: d.summary, status: d.status === "cancelled" ? "cancelled" : "booked", match_id: d.match_id }));
export function dateGroups(s: MockState, now = Date.now()) {
  const proposed = s.dates.filter((d) => d.status === "proposed").sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const rest = s.dates.filter((d) => d.status !== "proposed");
  const { upcoming, past } = splitDates(rest.filter((d) => d.status === "booked"), now);
  const cancelled = rest.filter((d) => d.status === "cancelled");
  return {
    proposed,
    upcoming: [...upcoming].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
    past: [...past, ...cancelled].sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))
  };
}
export const isPastDate = (d: MockDate, now = Date.now()) => d.status === "booked" && Date.parse(d.starts_at) < now - 3 * HOUR;

// --- actions (pure: state in, state out) ----------------------------------------------------------

const update = (s: MockState, id: string, fn: (m: MockMatch) => MockMatch): MockState => ({ ...s, matches: s.matches.map((m) => (m.id === id ? fn(m) : m)) });
const addMsg = (m: MockMatch, sender: Sender, body: string, now: number): MockMatch => ({
  ...m, seq: m.seq + 1, messages: [...m.messages, { id: `${m.id}-${m.seq + 1}`, sender, body, sent_at: new Date(now).toISOString() }]
});

/** The user's message (typed after taking over, or an approved draft). Empty and oversize text are refused. */
export function sendMessage(s: MockState, matchId: string, body: string, now = Date.now()): { state: MockState; error?: string } {
  const text = body.trim();
  if (!text) return { state: s, error: "Write something first." };
  if (text.length > MAX_MESSAGE) return { state: s, error: `Keep it under ${MAX_MESSAGE} characters.` };
  const match = s.matches.find((m) => m.id === matchId);
  if (!match) return { state: s, error: "That chat is gone." };
  return {
    state: update(s, matchId, (m) => {
      const sent = addMsg(m, "user", text, now);
      const more = sent.scriptIdx < sent.script.length;
      return { ...sent, draft: null, needs_user: false, needs_reason: null, pendingReplyAt: more && !sent.pendingReplyAt ? new Date(now + REPLY_DELAY_MS).toISOString() : sent.pendingReplyAt };
    })
  };
}

export const takeOver = (s: MockState, id: string, now = Date.now()) =>
  update(s, id, (m) => (m.mode === "user" ? m : { ...addMsg(m, "system_internal", encodeSystemEvent({ kind: "took_over" }), now), mode: "user", draft: null, needs_user: false, needs_reason: null }));

export function handBack(s: MockState, id: string, now = Date.now()): MockState {
  return update(s, id, (m) => {
    if (m.mode === "ai") return m;
    const back = { ...addMsg(m, "system_internal", encodeSystemEvent({ kind: "handed_back" }), now), mode: "ai" as const };
    return needsDraft(back) ? withDraft(back) : back;
  });
}

/** Their message is the last one and nothing is queued: a draft makes sense. */
function needsDraft(m: MockMatch): boolean {
  return m.mode === "ai" && !m.draft && !m.pendingReplyAt && lastReal(m)?.sender === "match";
}
function withDraft(m: MockMatch, options?: string[]): MockMatch {
  const prev = m.scriptIdx > 0 ? m.script[m.scriptIdx - 1]?.drafts : [];
  const opts = options?.length ? options : prev?.length ? prev : GENERIC_DRAFTS;
  return { ...m, draft: { options: opts, i: 0 }, needs_user: true, needs_reason: `${firstName(m.name)} is waiting on you` };
}
const firstName = (name: string) => name.split(/[\s-]+/)[0] || name;

/** "Draft a reply" when none is showing (after skipping one, or after handing a chat back). */
export const requestDraft = (s: MockState, id: string) => update(s, id, (m) => (needsDraft(m) ? withDraft(m) : m));
export const nextDraft = (s: MockState, id: string) => update(s, id, (m) => (m.draft ? { ...m, draft: { ...m.draft, i: (m.draft.i + 1) % m.draft.options.length } } : m));
export const skipDraft = (s: MockState, id: string) => update(s, id, (m) => ({ ...m, draft: null, needs_user: false, needs_reason: null }));

/** The match answers: their scripted reply lands, and in autopilot a draft for the next answer is prepared. */
export function fireReply(s: MockState, id: string, now = Date.now()): MockState {
  return update(s, id, (m) => {
    const step = m.script[m.scriptIdx];
    if (!m.pendingReplyAt) return m;
    if (!step) return { ...m, pendingReplyAt: null };
    const replied = { ...addMsg(m, "match", step.reply, now), scriptIdx: m.scriptIdx + 1, pendingReplyAt: null };
    return replied.mode === "ai" ? withDraft(replied, step.drafts) : replied;
  });
}

export function confirmDate(s: MockState, id: string, slotIso?: string, now = Date.now()): MockState {
  const d = s.dates.find((x) => x.id === id);
  if (!d || d.status === "booked") return s;
  const startsAt = slotIso && d.slots.includes(slotIso) ? slotIso : d.starts_at;
  const dates = s.dates.map((x) => (x.id === id ? { ...x, status: "booked" as const, starts_at: startsAt, slots: [] } : x));
  const next = { ...s, dates };
  return d.match_id ? update(next, d.match_id, (m) => addMsg(m, "system_internal", encodeSystemEvent({ kind: "date_booked", startsAt, venue: d.venue }), now)) : next;
}
export const cancelDate = (s: MockState, id: string): MockState => ({ ...s, dates: s.dates.map((x) => (x.id === id && x.status !== "cancelled" ? { ...x, status: "cancelled" as const, slots: [] } : x)) });
export const rateDate = (s: MockState, id: string, outcome: DateOutcome): MockState => ({ ...s, dates: s.dates.map((x) => (x.id === id ? { ...x, outcome } : x)) });

// --- profile ------------------------------------------------------------------------------------

/** Validates exactly like the real server action, then writes the answers into the mock profile. */
export function saveStep(s: MockState, step: StepName, payload: unknown): { state: MockState; error?: string } {
  const parsed = stepSchemas[step].safeParse(payload);
  if (!parsed.success) return { state: s, error: parsed.error.issues[0]?.message ?? "Check your answers." };
  const v = parsed.data as Record<string, unknown>;
  const p = s.profile;
  const three = (list: unknown) => { const a = (list as string[]) ?? []; return [a[0] ?? "", a[1] ?? "", a[2] ?? ""]; };
  const str = (n: unknown) => (n === null || n === undefined ? "" : String(n));
  let profile: MockProfile = p;
  if (step === "name") profile = { ...p, firstName: String(v.firstName) };
  if (step === "birthday") profile = { ...p, birthday: String(v.birthday) };
  if (step === "who") profile = { ...p, gender: String(v.gender), interestedIn: v.interestedIn as string[] };
  if (step === "about") profile = { ...p, job: String(v.job), heightCm: str(v.heightCm), interests: three(v.interests) };
  if (step === "type") profile = { ...p, city: String(v.city), ageMin: str(v.ageMin), ageMax: str(v.ageMax), distanceKm: str(v.distanceKm), lookingFor: String(v.lookingFor), dealbreakers: three(v.dealbreakers) };
  let apps = s.apps;
  if (step === "apps") {
    const chosen = v.apps as App[];
    profile = { ...p, apps: chosen };
    // Newly added apps start in setting up; apps already there keep their state.
    apps = [...s.apps, ...chosen.filter((a) => !s.apps.some((x) => x.app === a)).map((app) => ({ app, status: "setting_up" as const, user_paused: false }))];
  }
  return { state: { ...s, profile, apps } };
}
export const setAppPaused = (s: MockState, app: string, paused: boolean): MockState => ({ ...s, apps: s.apps.map((a) => (a.app === app ? { ...a, user_paused: paused } : a)) });
export const saveSettings = (s: MockState, voice: string, notifyEmail: boolean): MockState => ({ ...s, profile: { ...s.profile, voice, notifyEmail } });
export const setPhotos = (s: MockState, photos: Photo[]): MockState => ({ ...s, photos: photos.map((p, i) => ({ ...p, position: i })) });
export const setOnboardingStep = (s: MockState, step: number, draft?: Draft): MockState => ({ ...s, onboarding: { ...s.onboarding, step }, profile: draft ? { ...s.profile, ...draft } : s.profile });

/** Finishing onboarding: the apps they picked are running, and their first matches and chats have arrived. */
export function completeOnboarding(s: MockState, now = Date.now()): MockState {
  const chosen = s.profile.apps;
  const base = seed(now);
  const apps: AppAccountRow[] = chosen.map((app) => ({ app, status: "active", user_paused: false }));
  const matches = base.matches.filter((m) => chosen.includes(m.app));
  const keep = new Set(matches.map((m) => m.id));
  const dates = base.dates.filter((d) => d.match_id === null || keep.has(d.match_id));
  return { ...s, onboarding: { done: true, step: 0 }, apps, matches, dates, matchesThisWeek: matches.length ? matches.length + 8 : 0, profile: { ...s.profile, firstName: s.profile.firstName.trim() || "there" } };
}

// --- persistence ---------------------------------------------------------------------------------

/** Parses what localStorage held; anything unfamiliar (old version, hand-edited, corrupt) is treated as nothing. */
export function parseStored(raw: string | null): MockState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<MockState>;
    if (!v || v.v !== MOCK_VERSION || !Array.isArray(v.matches) || !Array.isArray(v.dates) || !Array.isArray(v.apps) || !Array.isArray(v.photos) || !v.profile || !v.onboarding) return null;
    return v as MockState;
  } catch {
    return null;
  }
}
