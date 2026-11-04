// Sample people and sample chats for /demo. Everything here is invented: the faces are synthetic
// portraits of people who do not exist (public/demo), the names and messages are written for the demo.
// Matches only ever see ordinary texting from the user, so no message mentions NoSwipe, AI or bots.
import type { ChatSummary } from "@/lib/app/data";
import type { Draft } from "@/lib/app/draft";
import type { AppAccountRow, DateRow, Sender } from "@/lib/app/domain";
import { encodeSystemEvent } from "@/lib/app/domain";

export type DemoMessage = { id: string; match_id: string; sender: Sender; body: string; sent_at: string };
export type DemoChat = ChatSummary & { messages: DemoMessage[] };

const MIN = 60_000, HOUR = 3_600_000, DAY = 24 * HOUR;

/** Next occurrence of a weekday (0 = Sunday) at an hour, in US Pacific standard time (UTC-8). */
function nextWeekday(now: number, weekday: number, hourPst: number): string {
  const d = new Date(now - 8 * HOUR); // shift so UTC getters read Pacific wall-clock
  const ahead = (weekday - d.getUTCDay() + 7) % 7 || 7;
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ahead, hourPst + 8, 0, 0);
  return new Date(t).toISOString();
}

export function buildDemo(now = Date.now()) {
  const at = (msAgo: number) => new Date(now - msAgo).toISOString();
  const thu = nextWeekday(now, 4, 19);
  const sat = nextWeekday(now, 6, 11);

  const msg = (match: string, n: number, sender: Sender, body: string, msAgo: number): DemoMessage => ({ id: `${match}-${n}`, match_id: match, sender, body, sent_at: at(msAgo) });
  const maya: DemoMessage[] = [
    msg("maya", 1, "match", "ok so the trail story. did you actually fall in the creek or is that embellished", 2 * DAY + 3 * HOUR),
    msg("maya", 2, "as_user_ai", "haha fully fell in. my dog just stood there judging me", 2 * DAY + 3 * HOUR - 4 * MIN),
    msg("maya", 3, "match", "ok you win. want to grab food this week? i'm thinking mexican", 2 * DAY + 2 * HOUR),
    msg("maya", 4, "as_user_ai", "oh yesss that would be cool, i love mexican food, there's a taco place on 5th that's amazing, thursday?", 2 * DAY + 2 * HOUR - 3 * MIN),
    msg("maya", 5, "match", "Thursday works! 7?", 2 * DAY + HOUR),
    msg("maya", 6, "as_user_ai", "perfect, see you there 🙂", 2 * DAY + HOUR - 2 * MIN),
    { id: "maya-7", match_id: "maya", sender: "system_internal", body: encodeSystemEvent({ kind: "date_booked", startsAt: thu, venue: "Taco place on 5th" }), sent_at: at(2 * DAY + HOUR - 3 * MIN) }
  ];
  const jess: DemoMessage[] = [
    msg("jess", 1, "as_user_ai", "ok I have to ask, is the climbing gym photo from this year or 2019 Jess", 5 * HOUR),
    msg("jess", 2, "match", "lol 2023, i'm slower now", 5 * HOUR - 12 * MIN),
    msg("jess", 3, "as_user_ai", "slower than me is still faster than the guy in the background", 4 * HOUR + 50 * MIN),
    msg("jess", 4, "match", "ok that's my brother. also is it ok if we move to whatsapp?", 40 * MIN)
  ];
  const lin: DemoMessage[] = [
    msg("lin", 1, "match", "your bio says you make pasta from scratch. prove it", 20 * HOUR),
    msg("lin", 2, "as_user_ai", "challenge accepted. i make a mean cacio e pepe, ask me about the time the pecorino exploded", 20 * HOUR - 6 * MIN),
    msg("lin", 3, "match", "ok now I need the story", 3 * HOUR),
    { id: "lin-4", match_id: "lin", sender: "system_internal", body: encodeSystemEvent({ kind: "took_over" }), sent_at: at(2 * HOUR + 40 * MIN) },
    msg("lin", 5, "user", "ok so picture this. 8pm, tiny apartment, one very sad block of pecorino", 2 * HOUR + 30 * MIN)
  ];

  const last = (m: DemoMessage[]) => [...m].reverse().find((x) => x.sender !== "system_internal") ?? null;
  const base = (id: string, name: string, age: number, app: "hinge" | "tinder" | "bumble", photo: string, matchedAgo: number, m: DemoMessage[], mode: "ai" | "user", needs?: string): DemoChat => ({
    id, app, name, age, photo_path: null, matched_at: at(matchedAgo), needs_user: Boolean(needs), needs_reason: needs ?? null,
    photoUrl: photo, last: last(m), mode, paused: false, messages: m
  });
  const chats: DemoChat[] = [
    base("jess", "Jess", 30, "tinder", "/demo/jess.jpg", 6 * HOUR, jess, "ai", "Jess asked to move to WhatsApp"),
    base("lin", "Lin", 27, "bumble", "/demo/lin.jpg", DAY + 4 * HOUR, lin, "user"),
    base("maya", "Maya", 28, "hinge", "/demo/maya.jpg", 3 * DAY, maya, "ai")
  ].sort((a, b) => Date.parse(b.last?.sent_at ?? b.matched_at) - Date.parse(a.last?.sent_at ?? a.matched_at));

  const dates: (DateRow & { match_id: string | null })[] = [
    { id: "d-maya", who: "Maya", venue: "Taco place on 5th", address: "512 5th St", starts_at: thu, summary: "The creek story, her dog, and a shared love of mexican food.", status: "booked", match_id: "maya" },
    { id: "d-lin", who: "Lin", venue: "Blue Bottle Coffee", address: "66 Mint St", starts_at: sat, summary: "Pasta from scratch, and the great pecorino incident.", status: "booked", match_id: "lin" }
  ].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  const apps: AppAccountRow[] = [
    { app: "tinder", status: "live", user_paused: false },
    { app: "hinge", status: "live", user_paused: false },
    { app: "bumble", status: "live", user_paused: false }
  ];
  const draft: Draft = {
    firstName: "Alex", birthday: "1996-05-14", gender: "man", interestedIn: ["women"], job: "Product designer", heightCm: "180", interests: ["Hiking", "Cooking", "Live music"],
    city: "Austin", ageMin: "25", ageMax: "33", distanceKm: "50", lookingFor: "meaningful", dealbreakers: ["Smokes", "Rude to waiters", "No sense of humor"], apps: ["tinder", "hinge", "bumble"]
  };
  const photos = [1, 2, 3].map((n) => ({ id: `alex-${n}`, path: `demo/alex-${n}`, position: n - 1, url: `/demo/alex-${n}.jpg` }));
  return { chats, dates, apps, draft, photos, name: "Alex", age: 30, matchesThisWeek: 14 };
}
