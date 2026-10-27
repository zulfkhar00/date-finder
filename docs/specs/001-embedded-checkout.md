# Pay inside NoSwipe and return to verified confirmation

**Problem.** Reservations currently navigate to Stripe-hosted checkout. Miko requested payment inside NoSwipe after an intentionally expired, unpaid launch probe displayed Stripe’s generic closed-session page. The live account and signed expiry webhook have been verified; a paid transaction has not.

**Not doing.** No fee, subscription, schema, payout, eligibility or fulfillment changes. The fee remains a one-time USD 1.00 reservation fee; dating service pricing remains separate. Existing production webhook corrections are preserved.

**Options.** Hosted checkout is simpler but leaves the site. Custom Elements requires more payment-state code. Use Stripe’s full embedded checkout page, which keeps Stripe’s payment UI and authentication within the existing reservation flow.

**Approach.** Add a typed presentation helper for embedded versus hosted session creation. New reserve-form clients request embedded checkout, receive the account’s publishable key and session client secret, and mount Stripe’s official embedded page SDK. Retain hosted responses for cached clients and deployment compatibility. The SDK completion callback navigates to /confirmation; that page continues to verify paid status server-side. Mount errors provide a retry of the same session. Retain answers and prevent duplicate form submissions. Configure the matching live publishable key and canonical www SITE_URL in the existing Vercel project; deploy without assigning production domains, inspect, then promote. Pin PostCSS 8.5.32 to address the existing audit finding before shipping.

**Risk.** Wrong account keys or an SDK/API mismatch can prevent the payment widget from loading. Returning to confirmation must never imply payment. Preserve rollback to the prior verified deployment; do not promote until the real embedded UI renders. No test card numbers may be used in live mode.

**Verification.** Run npm test, npm run typecheck, npm run lint and npm run build. Contract checks assert embedded and hosted redirect parameters are mutually exclusive, old clients retain hosted checkout, and missing secrets are rejected. In Chrome, finish the form, verify NoSwipe and USD 1.00 inside /reserve, check the confirmation route rejects an unpaid/expired session, and verify a genuine signed webhook delivery. A real successful payment, receipt and refund are reported separately and only marked verified if performed.
