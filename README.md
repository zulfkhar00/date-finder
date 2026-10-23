# NoSwipe — early-access waitlist

Stop swiping, start dating. NoSwipe is a dating concierge for guys on Tinder, Hinge and Bumble: we rebuild the profile and draft openers and replies from screenshots; he sends every message himself. This repo is the landing page plus a $1 paid early-access waitlist. Live at https://noswipe.app.

## Design

Bright, light and phone-first (most traffic is TikTok/IG on phones). Warm white `#FFF8F0`, deep grape ink `#22104A`, hot coral `#FF5A47` for the brand and actions, electric lime `#C9F24D` for NoSwipe's "voice" (suggestions, highlights, confirmations), plus lilac `#DCD0FF` and blush `#FFE3DB` as section and chat tints. No gradients in the brand and no dark sections. Thick grape borders with hard offset shadows give it a sticker feel. Type is self-hosted with Fontsource: **Bagel Fat One** for big display moments and **Figtree Variable** for everything else. Radius scale: 6 / 10 / 14 / 20 / 28 / pill.

Page order: hero with an animated example chat → interactive "fix my text / fix my bio" demo (pre-written examples, no API calls) → match → chat → date example stack → how it works → founding members (with a live count of real **live-mode** paid places, hidden below 10) → testimonials (rendered only from consented entries in `src/content/testimonials.json`, which ships empty) → pricing ($1 now, $19 / $5 marked planned) → FAQ → closing CTA. All example chats and profiles are labelled "Example" and use abstract initial avatars, never photos of people.

Never add invented testimonials, ratings or user counts. The FTC's 2024 rule (16 CFR 465) makes fake reviews a civil-penalty violation.

Funnel hook points call `track()` from `src/lib/track.ts`, which is a no-op until the funnel-tracking work fills it in.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, customized shadcn-style button and Radix accordion primitives, Motion for React, Supabase Postgres, Stripe Checkout.

For a self-hosted Dokploy deployment, follow [DEPLOYMENT.md](DEPLOYMENT.md).

## Set up

1. Install dependencies with `npm ci`.
2. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor. The schema enables RLS, revokes browser-role access, and grants only `service_role` access. The `finalize_reservation` RPC assigns waitlist numbers transactionally and returns the existing number on duplicate delivery.
3. Copy `.env.example` to `.env.local` and set all server secrets. Keep the Supabase secret key and Stripe secret key out of `NEXT_PUBLIC_` variables.
4. In Stripe **test mode**, create a webhook endpoint for `/api/stripe/webhook` and subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `charge.refunded`. Checkout is restricted to cards for this MVP, so asynchronous payment events are defensive. Configure a support contact and payment receipts in Stripe before launch; the privacy and terms pages direct customers to that contact.
5. Run `npm run dev`. For local webhooks, run `stripe listen --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,charge.refunded --forward-to localhost:3000/api/stripe/webhook` and set its `whsec_...` signing secret. Keep this listener running during test payments.
6. Set `SITE_URL` to the deployed HTTPS origin before production. Use live Stripe keys and a live webhook secret only after reviewing the test flow.

## Payment behavior

- Server validates all form fields and stores a pending record before creating a fixed USD $1 Checkout Session. The session disables Stripe Managed Payments, which otherwise rejects the explicit card setting on some accounts and can add tax to the $1 price.
- The browser redirect never confirms payment. The signed Stripe webhook checks mode, amount, currency, payment state, and reservation identity before calling the database transaction.
- A duplicate paid webhook returns the same position. Checkout expiration marks an unpaid record expired.
- The confirmation page polls only the stored status using the unguessable Checkout session ID. It does not expose questionnaire answers.
- The $1 fee is disclosed as nonrefundable before Checkout, except where required by law. There is no self-service refund endpoint. If a refund is issued manually in Stripe, the `charge.refunded` webhook removes the active waitlist place. Keep confirmation links private.

## Verification

Run `npm run typecheck`, `npm run lint`, and `npm run build`. Run [`supabase/verify.sql`](supabase/verify.sql) in the SQL editor to check sequential, idempotent queue assignment as `service_role` inside a rolled-back transaction. Test Checkout with Stripe's test card `4242 4242 4242 4242`, then verify one paid row and position in Supabase. Replay the same Stripe event and confirm the position stays unchanged. Test a canceled Checkout and a manual test-mode refund in Stripe, then confirm that the webhook marks the place inactive. A full payment test requires server-side Supabase credentials and Stripe test credentials. On the connected project, [`supabase/connected-project-hardening.sql`](supabase/connected-project-hardening.sql) was also applied to remove unnecessary browser access to its pre-existing RLS event-trigger function.

### Funnel tracking

Apply [`supabase/2026-10-23-funnel-tracking.sql`](supabase/2026-10-23-funnel-tracking.sql). It is idempotent. Without it the app keeps working and logs `Funnel event insert failed` or `retrying without` instead. Then:

1. Open `/?utm_source=test&utm_medium=cpc&utm_campaign=verify&variant=men` in a fresh private window. DevTools shows a first-party `ns_attr` cookie (first touch, 30 days), `ns_sid` in sessionStorage, and a `POST /api/event` returning 204. A later visit with different UTMs does not overwrite the cookie.
2. Go to `/reserve`. This records one `reserve_start` per tab session. Complete the form with test card `4242 4242 4242 4242`. The new `reservations` row has `utm_*`, `variant = men`, and `referrer` (origin only, null for direct or same-site visits).
3. In `funnel_events`, the same `session_id` has `page_view`, `reserve_start`, `checkout_created` and, after the webhook, `paid`. Replaying the Stripe event does not add a second `paid` row (`dedupe_key`).
4. Start another checkout and go back from Stripe. The `/reserve?cancelled=1` return records `checkout_canceled`.
5. `POST /api/event` rejects `paid`, `checkout_created` and malformed bodies with 400, and returns 429 after 30 requests per minute per client.
6. Run [`supabase/funnel.sql`](supabase/funnel.sql) for daily counts per event and visitor→paid % by variant and `utm_campaign`.

No third-party trackers are loaded. UTM values containing `@` are dropped and referrers are cut to their origin, so the funnel stores no personal data.

### Admin dashboard

`/admin` (founders only) shows the funnel and leads; set-up is in [DEPLOYMENT.md §7](DEPLOYMENT.md#7-admin-dashboard). Apply [`supabase/2026-10-23-admin.sql`](supabase/2026-10-23-admin.sql) after the funnel SQL, set `SUPABASE_PUBLISHABLE_KEY` and `ADMIN_EMAILS`, and sign in with an emailed link or code. To check it: an allowlisted email can sign in and sees KPI tiles matching `supabase/funnel.sql`; any other signed-in email gets a 404 on `/admin`, `/admin/leads/<id>` and `/admin/leads/export`; signed out, `/admin/leads/export` returns 404.
