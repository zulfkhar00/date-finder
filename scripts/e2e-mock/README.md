# Local mock e2e: signup -> onboarding -> pay -> confirmation

Runs the real app against in-memory stand-ins for Supabase (GoTrue + PostgREST + `finalize_reservation`),
Stripe (Checkout Sessions + a signed `checkout.session.completed` webhook), Resend and Telegram.
No Docker, no network, no credentials. **This is a mock, not Stripe test mode**: it proves the app's
own navigation, state transitions, webhook signature check, finalize step and confirmation polling,
not Stripe's hosted UI or Stripe.js (the embedded checkout is a labelled stub in `drive.mjs`).

`preload.cjs` re-routes api.stripe.com / api.resend.com / api.telegram.org to the mock and throws on
every other non-local host, so production Supabase, live Stripe and PostHog cannot be reached.

```bash
node scripts/e2e-mock/mock-services.mjs &                      # :54399 (MOCK_LOG=1 for a request log)
set -a; . scripts/e2e-mock/env.example; set +a                 # test-mode placeholder keys only
npx next dev --webpack -p 3000 &                               # SITE_URL must be http://localhost:3000
PW_CORE=/path/to/playwright-core PW_CHROMIUM_PATH=/path/to/chrome \
  node scripts/e2e-mock/drive.mjs /tmp/shots desktop           # or: mobile
node --conditions=react-server --import tsx scripts/e2e-mock/classify.ts   # does the dashboard count it?
```

`--webpack` is only needed when `node_modules` is a symlink (Turbopack refuses it). With
`SITE_URL=http://localhost:3000` the funnel events are recorded (see `isNonProductionOrigin`); without
it `/api/event` drops localhost traffic with a 204.
