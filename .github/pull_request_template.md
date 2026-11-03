## What

<!-- What changed, in a few bullets. -->

## Why

<!-- The problem or goal. Link the plan item or issue. -->

## How it was verified

- [ ] `npm ci && npm run typecheck && npm run lint && npm run build`
- [ ] Payments code touched (checkout, webhook, queue counter)? Stripe test-mode run documented below
- [ ] Schema change? New idempotent SQL file under `supabase/`, RLS on, browser roles revoked, not run against prod

<!-- Commands run, what you saw, what was not verified. -->

## Screenshots BEFORE / AFTER

<!-- The CI check "UI proof" blocks merge if this PR changes anything user-visible (see
     .github/ui-proof.json) and this section has no BEFORE image and no AFTER image.
     Keep the heading - the script reads it.
       - Drag screenshots/video into the table cells (from the live UI: the running app, desktop and mobile; never real user screenshots or personal data).
       - Or commit them under docs/screenshots/<pr>/ (before-*.png, after-*.png).
       - The `PR shots` bot posts an "Auto screenshots" comment for web routes; it counts as proof.
     - Nothing visible changes: add the label `no-visual-change` and write a one-line reason here.
     Editing this description or the label re-runs the check; no new commit needed. -->

| BEFORE | AFTER |
|---|---|
|  |  |


Closes #
