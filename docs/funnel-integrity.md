# Funnel integrity: signups and internal traffic

Analytics only. No payment, checkout or eligibility behaviour changes.

## What the digest shows
`Confirmed signups (first email confirmation): <24h> (30d <n>)` sits next to `Get started clicks` (intent).
A signup is one `signup_confirmed` funnel event per account, recorded the first time a code or sign-in link is
verified: onboarding's inline code step, standalone `/login`, and the emailed link all go through
`recordFirstConfirmation` (`src/lib/signups.ts`). "First" = the account has no `profiles` row yet at that
moment (`ensureProfile` creates it right after sign-in); the event also has a per-account dedupe key, so a
repeat login can never add a second one. If the profile lookup fails nothing is recorded (a gap, not an overcount).
Counts start when the migration is applied: the digest says `counted since <date>` while the 30d window is
only partly covered, `n/a (not tracked yet)` before any event, and `n/a` when the query fails or the migration is missing.

## How events are linked to accounts
`funnel_events` used to carry only a random per-tab `session_id`, so only a checkout (reservation email) could tie a
session to a founder. Now `/api/event` reads the sign-in cookie server-side and stamps events from a signed-in
browser with `user_id` and `account_internal` (the email is classified with `lib/internal-traffic` and dropped).
`internalSessionIds` (shared by the digest, `/admin` overview, traffic, videos and the checkout panel) drops every
session that has any event from an internal account or from a profile flagged `internal`, including the guest
events earlier in the same tab session (guest-to-member). Existing exclusions are unchanged: founder/test emails
on reservations, `cs_test_` Stripe test mode, probe session ids (`00000000-`, set by `?internal=1`).
Never inferred from IP, device or user agent.

## Unclassifiable data (documented gaps)
- Rows written before `supabase/2026-11-21-funnel-account-link.sql` have no account. A founder session from then that
  never reached a checkout still counts and cannot be recovered.
- A founder browsing as a guest in a tab that never signs in has no account link; only `?internal=1` or a checkout
  excludes it.
- Accounts confirmed before this change have no `signup_confirmed` row; they are not backfilled.
- `INTERNAL_EMAILS` changes apply to new events; `profiles.internal` is read at report time, so flagging a profile
  later also drops its already-tagged sessions.
- Before the migration is applied, inserts fall back to the old row shape and the funnel keeps its old exclusions.
