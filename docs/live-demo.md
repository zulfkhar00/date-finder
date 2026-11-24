# Live demo mode (internal accounts only)

Makes an internal account's real app look like NoSwipe is running its dating apps, so a founder can film it. Home, Chats, the thread view and Dates are the real screens with real rows; nothing on the client UI says "demo".

## Use it

Admin, Clients, open the internal account: **Live demo mode**.

- **Demo mode: off (turn on)**: cleans any old demo rows, adds Tinder/Hinge/Bumble if the account lacks them, copies the persona photos, writes the opening state (7 matches across the three apps, chats part-way, one booked date, today's swipes), starts the simulation.
- **Demo mode: on (turn off)**: stops new activity. The chats stay as they are.
- **Reset demo**: deletes every demo row, photo and app the demo added. If demo mode is on it starts over from the opening state.

Only `profiles.internal = true` accounts show the card; the service and a database trigger both refuse anyone else.

## How it moves

The open page (layout, internal + demo on only) runs an invisible ticker that POSTs `/api/app/demo/tick` every ~8 to 13 s while the tab is visible and refreshes when something happened. The server does at most **one action per tick**, no sooner than a random 9 to 26 s after the last (`demo_sessions.next_action_at`), and the claim is one atomic UPDATE with a 25 s lock, so extra tabs never double an action. Closed page, no ticks, nothing generated. Actions: a new match (persona order, every 50 s at most), her next line, his next line (as `as_user_ai`, the real "Sent by NoSwipe" tag), a swipe batch, or booking the date after the closing line. Every message has a unique `external_id` (`demo-msg-<match>-<n>`), so even a lock failure cannot double a line.

A chat is a script of 7 to 9 turns (`src/lib/demo/personas.ts`), ending in: he proposes a day, time and place, she says yes, he closes, and the date is booked (Dates + Home counters + a date notice in the thread). The day and time are the viewer's own zone (the page sends it); venue names are invented. Chats the user takes over, or whose app is paused, are left alone. No email is sent for demo dates.

## A full mock to browse

- **Source app everywhere**: a Tinder / Hinge / Bumble chip on every Chats row, the thread header, Home's active chats, Dates rows and the date page, with "Matched 3 h ago" where the match has a profile.
- **Match profile page** (`/chats/<id>/profile`, tap the avatar or name in a thread): 3-photo carousel, name and age, source app, how and when you matched, distance, job, bio, and the app's own extras (Hinge prompts, Bumble question badges, Tinder passions). Stored as `matches.profile` jsonb (`supabase/2026-11-24-match-profiles.sql`); a match without one has no profile link, so ordinary accounts see no new page.
- **Read state**: `matches.last_read_at`. Her messages after it show an unread count on the Chats row and a bold row; opening the chat marks it read. Null (ordinary accounts) means no tracking and no badge.
- **Backstory**: 10 chats at the start, 3 of them full 2-4 day old conversations with booked (one already past) dates, 4 with unread messages, 1 brand new match; 4 more personas arrive live. Per-app swipes, matches, chats and dates reach Home's app cards through `account_activity`.
- Dates link back to the chat and show the app and match time.

## Model and cost cap

Lines are written by the existing Anthropic path (`createAnthropicModel`, key server-side): `claude-sonnet-5-5` for his lines, `claude-haiku-5-5` for hers, each given the persona or his known profile facts, the last 10 messages and the canned line as a direction. Output is checked (`cleanLine`: length, one paragraph, no bot tells, no contact details, no explicit words, a proposal must name the venue). A failed, refused, slow (9 s) or rejected call, a missing key, or the cap, falls back to the canned line, so the chat never stalls.

Cap: **$0.50 per UTC day** (`DAILY_CAP_MICRO`), metered per call from token usage at $3 / $15 per million tokens and stored in `demo_sessions.spent_micro`. Past it every line is canned. A chat line is roughly $0.001 to $0.003, so the cap is a safety net.

## Isolation

Every row written has `demo = true` (matches, messages, dates, account_activity); reset also removes the old `demo-*` seeds. The metrics and reports read reservations and funnel events, not these tables, so nothing counts; the per-client admin panels do show them on purpose. `demo_sessions` is server only (RLS on, browser roles revoked).

## Photos

Portraits are **synthetic StyleGAN faces of people who do not exist**, taken from the Hugging Face dataset `javi22/this-person-does-not-exist-10k` (MIT, a collection of thispersondoesnotexist.com outputs; the faces are StyleGAN2 samples and depict no real person). 14 adult-looking faces were picked by eye from the first 120, cropped to 4:5 and stored once in the private `profile-photos` bucket under `demo/`; enabling demo mode copies them to `<user id>/demo/` so the owner's signed URLs work; reset deletes the copies. No photo is committed to Git. One portrait per persona (the app shows one avatar per match). StyleGAN code and weights are NVIDIA's non-commercial licence; the outputs are generated images of nobody and the demo is an internal filming aid, but do not reuse these faces in paid ads without checking the licence again.
