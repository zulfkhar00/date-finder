# Make production acquisition measurable end to end

**Problem.** NoSwipe's first real external signup had to be attributed by correlating raw timestamps: an Instagram bio session landed at 03:16:24 UTC and the account was created 11 seconds later. The first-party funnel captures UTM, referrer, landing page, device, and country, but Vercel Web Analytics is disabled and the account record is not directly linked to its acquisition session.

**Not doing.** This change does not replace the existing privacy-conscious first-party funnel, add session recording, identify visitors across sites, alter pricing, or launch paid ads. It also does not claim that newly published SEO pages should already rank.

**Options.** PostHog would provide a deep product analytics UI but needs another configured vendor and identity plumbing. Vercel Web Analytics is cookie-free, already part of the hosting stack, and supplies an independent view of pages, referrers, devices, and countries. Keep the existing funnel as conversion truth and add Vercel as the production traffic cross-check; defer PostHog until there is a concrete analysis it uniquely answers.

**Approach.** Add `@vercel/analytics` to the Next.js root layout, enable Web Analytics on the linked Vercel project, deploy through the normal pull-request flow, and verify its production ingestion endpoint. Preserve the existing `/admin/traffic` funnel for UTMs and conversion events. Use stable UTM parameters on every ad or social link.

**Risk.** A broken analytics import could fail the production build; a disabled Vercel project setting could make the client script 404. Reverting the package/layout commit removes the integration, while the existing first-party analytics remains intact throughout.

**Verification.** `npm test`, `npm run lint`, and `npm run build` must pass. After deployment, the homepage HTML must include the Vercel analytics script, its script request must return 200, and a production visit must produce a successful view request. `/api/health`, `/`, and `/admin/traffic` must continue to load.
