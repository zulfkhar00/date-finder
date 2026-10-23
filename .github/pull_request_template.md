## What

<!-- What changed, in a few bullets. -->

## Why

<!-- The problem or goal. Link the plan item or issue. -->

## How it was verified

- [ ] `npm ci && npm run typecheck && npm run lint && npm run build`
- [ ] Payments code touched (checkout, webhook, queue counter)? Stripe test-mode run documented below
- [ ] Schema change? New idempotent SQL file under `supabase/`, RLS on, browser roles revoked, not run against prod

<!-- Commands run, what you saw, what was not verified. -->

## Screenshots

<!-- UI changes: before/after, desktop and mobile. Never include real user screenshots or personal data. -->

Closes #
