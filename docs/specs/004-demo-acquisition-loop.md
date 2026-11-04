# Let visitors preview NoSwipe and continue to signup

**Problem.** The public sample app exists, but the sign-in page offers no preview route. The demo layout has only a sample-data banner, with no signup CTA or page-view tracker. A campaign pointing at /demo can therefore lose both the visitor's next step and entry attribution. Read-only production snapshot before QA has zero non-test signups; this change does not promise conversion improvement.

**Not doing.** No authentication, onboarding implementation, checkout, account operation, production schema/data migration, landing rewrite, payment change, outreach or publication.

**Options.** Keep email-first access; link to the demo alone; or complete the small demo acquisition loop. Choose the loop so the existing sample app can support a real campaign without inventing customer outcomes.

**Approach.** Add the existing ghost-styled demo anchor to login. Reuse FunnelTracker on sign-in and the demo layout and CtaLink in its persistent banner to reach /onboarding; retain explicit sample labeling. Add scoped banner CSS for touch-sized responsive navigation. Existing attribution, internal-probe exclusion and signup authorization remain the implementation authority.

**Risk.** Mobile banner overflow, obscured sample labeling, lost first-touch UTM/ref or navigation counted as signup success. Keep the banner legible, reuse existing trackers, and distinguish demo views/CTA interest from actual confirmed signups.

**Verification.** Typecheck/lint/production build. Fresh desktop/mobile browser: login form still visible; demo anchor >=44px; navigate to demo/chats then Get started to signed-out login; sample labeling visible and no overflow. Mock /api/event responses, inspect one demo page_view and get_started with preserved campaign/ref and the same session; never submit email or make a payment. Capture real production BEFORE and local AFTER frames, independent review, CI, then verify the shipped route in a disposable internal-marked browser.
