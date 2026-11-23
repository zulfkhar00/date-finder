# Automation contract

The web app (this repo) owns accounts, data, consent, the user's chats UI and the rules. A separate **worker**
(Zulya's, one process per dating app or one for all) does the actual work on Tinder, Hinge and Bumble. The worker
never touches the database directly. It calls this HTTP API with a service key, and everything it does goes through
the same functions the admin console uses (`src/lib/automation/core.ts`), so the rules below hold no matter who calls.

Base URL: `https://www.noswipe.app/api/automation/v1` (use your local `SITE_URL` in development).

## Auth

`Authorization: Bearer <AUTOMATION_API_KEY>`. The key is a server env var (Vercel project settings), 32+ random
characters, compared in constant time. It is never `NEXT_PUBLIC_`, never sent to a browser and never committed.
Unset or short key: every call answers `503 {"code":"unconfigured"}`. Wrong key: `401 {"code":"unauthorized"}`.
Rotate it by changing the env var and redeploying.

All responses are JSON, `Cache-Control: no-store`. Success: `{"ok": true, ...}`. Failure:
`{"ok": false, "code": "...", "message": "..."}` with the HTTP status below. Request bodies are capped at 20 KB.
Timestamps are ISO 8601 with offset (`2027-01-14T19:00:00Z`). Ids are UUIDs.

## Rules the API enforces

1. **Takeover**: when the user has taken over a chat, `as_user_ai` messages are refused with **409 `taken_over`**.
   The database enforces it too (trigger `messages_guard`), so a race cannot slip a message through.
2. **Pause**: when the user paused an app (`userPaused: true`), `as_user_ai` messages for that app are refused with
   **409 `app_paused`**. Stop swiping on that app too; `effectiveStatus` tells you.
3. **Consent**: only act for clients whose brief has a non-null `consent`. Onboarding stores a timestamped row.
4. **Idempotency**: `externalId` on matches and messages makes retries safe (a repeat returns the existing id with `created: false`).
5. The user's own typed messages (after a takeover) are queued in the **outbox**; you send them in the app and ack them.
6. Never log message bodies, photos or profile details. Photos are served as 1-hour signed URLs; do not persist them
   beyond creating the profile.

## Endpoints

### `GET /clients?status=setting_up`
App accounts to act on. `status` is optional (`setting_up | live | paused`).
```json
{"ok":true,"accounts":[{"userId":"…","app":"hinge","status":"setting_up","userPaused":false,"effectiveStatus":"setting_up"}]}
```

### `GET /clients/{userId}`
Everything needed to build the profile. Every profile and preference field is optional for the user, so any of them can be `null` (or an empty list) and the worker must handle that; only the sign-in email and the consent (which includes the explicit 18+ confirmation) are guaranteed.
```json
{"ok":true,"client":{"id":"…",
  "profile":{"first_name":"Alex","birthday":"1996-05-14","gender":"man","interested_in":["women"],"city":"Austin","job":"Product designer","height_cm":180,"interests":["Hiking","Cooking","Live music"],"voice":"warm","onboarding_done_at":"…","internal":false},
  "preferences":{"age_min":25,"age_max":33,"distance_km":50,"looking_for":"meaningful","dealbreakers":["…","…","…"]},
  "apps":[{"app":"hinge","status":"setting_up","userPaused":false,"effectiveStatus":"setting_up"}],
  "photos":[{"position":0,"url":"https://…signed…"}],
  "consent":{"version":"2026-11-04","accepted_at":"…"}}}
```
`voice` is `warm | playful | direct`. `profile.internal: true` marks our own test accounts.

### `PUT /clients/{userId}/apps/{app}`   (`app`: `tinder | hinge | bumble`)
Create the app-account row or report its status. Body `{"status":"setting_up|live|paused"}`. → `{"ok":true,"app":"hinge","status":"live"}`.
The user sees it on Home ("We're setting up your Hinge" → "Live"). Report `paused` if the app restricts the profile.

### `POST /clients/{userId}/matches`
Ingest a match. Body `{"app":"hinge","externalId":"<the app's match id>","name":"Maya","age":28,"matchedAt":"…"}`
(`externalId`, `age`, `matchedAt` optional). → `{"ok":true,"matchId":"…","created":true}`.

### `GET /chats/{matchId}`
State plus the last 100 messages, oldest first, for drafting the next reply.
```json
{"ok":true,"chat":{"id":"…","userId":"…","app":"hinge","name":"Maya","mode":"ai","appStatus":"live","aiMaySend":true},
 "messages":[{"id":"…","sender":"match","body":"…","sent_at":"…"}]}
```
`mode` is `ai` or `user` (taken over). Check `aiMaySend` before drafting; it is false during a takeover or a pause.

### `POST /chats/{matchId}/messages`
Record a message. Body `{"sender":"match"|"as_user_ai","body":"…","sentAt":"…","externalId":"…"}`.
- `match`: always accepted (what the other person wrote).
- `as_user_ai`: record it **after** you sent it in the app (or just before; see below). Refused with 409 `taken_over` / `app_paused`.
→ `{"ok":true,"messageId":"…","created":true}`.

Order of operations for a send: (1) `GET /chats/{id}` and confirm `aiMaySend`; (2) draft; (3) `POST` the `as_user_ai`
message (the 409 is your last gate); (4) send it in the app. If step 4 fails, tell the user's chat nothing: the
thread already shows the message, so keep a retry and, if it keeps failing, `POST .../needs-you`.

### `POST /chats/{matchId}/needs-you`
Flag a chat that needs the user (she asked for a number, moved to WhatsApp, anything the AI must not decide).
Body `{"needsUser":true,"reason":"She asked to move to WhatsApp"}` (`reason` ≤ 200 chars, shown to the user). Shows on Home under
"Needs you" and emails the user once if they allow notifications. Send `{"needsUser":false}` to clear it.

### `GET /outbox` and `POST /outbox/{messageId}/ack`
Messages the user typed after taking over, not yet sent in the app (oldest first, up to 50):
```json
{"ok":true,"messages":[{"id":"…","match_id":"…","user_id":"…","body":"…","created_at":"…","matches":{"app":"hinge","external_id":"…","name":"Maya"}}]}
```
Send each one in the dating app exactly as written, then `POST /outbox/{id}/ack`. Un-acked messages stay in the outbox.

### `POST /clients/{userId}/dates`
Book a date. Body `{"matchId":"…"?,"who":"Maya","venue":"Taqueria on 5th","address":"500 5th St"?,"startsAt":"2027-01-14T19:00:00Z","summary":"What they talked about, ≤ 600 chars"?}`.
→ `{"ok":true,"dateId":"…"}`. It appears on the user's Dates tab (with a calendar download) and a "date booked" email is sent unless the user turned notifications off.

## Phone rig: runs and the activity feed

The phone rig (repo `edge-phone-agent`: Android phones driven by a Raspberry Pi, one job per phone and account) runs the dating profiles
NoSwipe creates for the client. The client connects nothing and logs in to nothing: they finish onboarding and we create the accounts on our
side. It talks to NoSwipe only through this API. Needs `supabase/2026-11-21-account-runs.sql`.

App states the client sees (`status` on the app account): `setting_up` (Setting up: we are creating the profile) -> `active`
(Running) -> `paused` / `closed`; `needs_client_action` (Needs you, with a reason the client reads, e.g. a new photo or a verification
selfie) at any point. `awaiting_login` is retired: old rows keep it and read as `setting_up`. The client's own pause
(`userPaused`) wins over `status`. Move the state with `PUT /clients/{userId}/apps/{app}` (`{"status":"setting_up"|"active"|"paused"|"needs_client_action","reason":"…"}`).

### `GET /runs?phoneId=<id>`
The rig's job list: every app account with its phone assignment (set by an operator in the admin Run panel) and a plain `shouldRun`.
```json
{"ok":true,"runs":[{"userId":"…","app":"hinge","phoneId":"pi-rack-1-phone-3","accountRef":"hinge-017","status":"active","userPaused":false,
  "effectiveStatus":"active","onboarded":true,"held":false,"timezone":"Europe/London","shouldRun":true}]}
```
`shouldRun` is true only when the client finished onboarding, the app is `active`, nobody paused it, no report hold applies and a phone is
assigned. Poll it (every minute or so) and stop work on an account the moment it turns false. `limit` (default 200, max 500).

`timezone` is the client's IANA zone (e.g. `Europe/London`) or `null` when unknown. Use it for quiet hours and daily swipe caps; when it is
`null`, fall back to your own default. It is captured silently from the browser during onboarding and an operator can correct it on the
admin client page. Only validated IANA names are ever returned. Needs `supabase/2026-11-22-client-timezone.sql`.

### `POST /activity`
Report what the phone did. Body `{"userId":"…","events":[ … 1 to 200 events … ]}`. Every event has `kind`, `app`, `idempotencyKey` (your own
id for the event, 8 to 200 chars, unique per client) and optional `occurredAt` (ISO 8601; not more than 5 minutes ahead, not older than 7 days).

| kind | extra fields | shows up as |
| --- | --- | --- |
| `swipes` | `count` (1 to 10000, one batch) | Swipes today |
| `match` | `matchRef?` (the app's match id) | New matches today |
| `chat` | `matchRef` | Chats active today (distinct `matchRef`s) |
| `date_booked` | `who` (first name), `venue`, `startsAt`, `address?`, `summary?`, `matchRef?` | Dates booked today, and a date on the Dates tab to confirm or decline (and the usual "date booked" email) |
| `needs_you` | `reason` (3 to 200 chars, the client reads it) | the app goes to Needs you; a pause or closure is never overridden |

Never send message text, names other than a match's first name on `date_booked`, photos or screenshots. `matchRef` is an opaque id.
```json
{"ok":true,"created":3,"duplicates":1,"rejected":1,"results":[
  {"index":0,"idempotencyKey":"swp-20261121-0001","status":"created"},
  {"index":1,"idempotencyKey":"swp-20261121-0001","status":"duplicate"},
  {"index":2,"idempotencyKey":"x","status":"rejected","code":"invalid","message":"Invalid event."}]}
```
Idempotent: a repeated `idempotencyKey` for the same client is `duplicate` and changes nothing (no second count, no second date, no second email), so
retry the whole batch after a timeout. Each event is judged alone; retry only the `rejected` ones that are not `invalid` / `no_account` / `bad_time`.
Rejected codes: `invalid`, `no_account` (the client never connected that app), `bad_time`. Whole-request errors: 400 `invalid`, 401, 404 `not_found`, 503 `migration`.

## Error codes

| HTTP | code | meaning |
| --- | --- | --- |
| 400 | `invalid` | bad JSON or body failed validation |
| 401 | `unauthorized` | missing or wrong key |
| 404 | `not_found` | unknown client, chat, message |
| 409 | `taken_over` / `app_paused` | the AI may not send; do not retry until the state changes |
| 500 | `db` | transient; retry with the same `externalId` |
| 503 | `unconfigured` | `AUTOMATION_API_KEY` or Supabase env not set |

## Not built yet (the rig's job)

Creating the accounts on each dating app from the onboarding data and photos, swiping by type and dealbreakers,
generating and sending the chats, deciding when a chat becomes a date, and health checks. Known risk for all of it:
Tinder, Hinge and Bumble restrict automated use of accounts in their terms and can limit or ban a profile; Tinder Face
Check and similar verification may stop account creation. Plan around bans (per-user pacing, pause on any restriction
signal by reporting `status: "paused"`), and never put one user's session or photos near another's.

## Local development

`.env.local` with `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SITE_URL=http://localhost:3000`,
`AUTOMATION_API_KEY` (32+ chars). Create a test user by signing in at `/login` with an `@example.test` address (it is
flagged internal automatically; with no Resend key, create a sign-in link with the Supabase admin API instead), then:
```sh
curl -H "Authorization: Bearer $AUTOMATION_API_KEY" http://localhost:3000/api/automation/v1/clients
```
