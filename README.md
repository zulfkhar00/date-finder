# Morrow — early-access waitlist

A premium editorial landing page and a $1 paid early-access waitlist for a private dating concierge. Concierge access is offered separately as availability opens.

## Design concept

**Private invitation.** The site uses a warm ivory editorial opening, a charcoal interactive concierge preview, and burgundy reservation moments. Cormorant Garamond provides high contrast display typography; DM Sans keeps the interface crisp. Thin rules, issue numbers, generous spacing, and a single original sculptural photograph create a magazine feel without simulated customer activity. The preview is explicitly illustrative.

Page order: service promise → how it would work → why it matters → interactive preview → transparent early-access price → FAQ → final call to action. The reservation is a separate three-step flow.

The original hero art was generated with the built-in image generation tool using a stylized-concept prompt for two burgundy sculptural forms facing across a limestone plinth, with charcoal surroundings, copper detail, and no people or text. The final project asset is `public/images/morrow-editorial.jpg`.

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
