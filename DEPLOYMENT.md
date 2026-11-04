# Deploy NoSwipe with Dokploy

The app runs as one Next.js container and uses the existing hosted Supabase project. The included `Dockerfile` builds Next.js standalone output and serves it on port 3000.

## 1. Push a private GitHub repository

This project's private GitHub repository is `zulfkhar00/date-finder`. Push the local `main` branch from this directory:

```sh
git push -u origin main
```

The repository excludes `.env.local`, build output, and local test artifacts. Confirm the GitHub repository is private before connecting it to Dokploy.

## 2. Create the Dokploy Application

In Dokploy, open **Git**, select **GitHub**, and create and install the Dokploy GitHub App. Grant it access to the private repository. In your Dokploy project, create an **Application**, select the GitHub source, the repository, and branch `main`. Set the build path to `/`, **Build Type** to **Dockerfile**, **Dockerfile Path** to `Dockerfile`, and **Docker Context Path** to `.`. Deploy the application. Dokploy can redeploy when new commits are pushed to `main`. The container listens on port `3000`. The image needs no persistent volume because reservation data lives in Supabase.

## 3. Connect the domain

Point the `noswipe.app` and `www.noswipe.app` A records to the IONOS server. In the application's **Domains** tab, add host `noswipe.app` (and `www.noswipe.app`), path `/`, container port `3000`, enable HTTPS, and select Let's Encrypt. Wait for a valid certificate before creating a public Stripe webhook.

`.app` is on the HSTS preload list, so browsers only ever load it over HTTPS. There is no plain-HTTP fallback, so the site is unreachable until the certificate is issued. Any previous host for this app should 301-redirect to `https://noswipe.app` once the new domain is live.

## 4. Set runtime environment variables

Add these in the Dokploy application's **Environment** tab. Use the exact deployed HTTPS origin for `SITE_URL`, with no path:

```dotenv
SITE_URL=https://noswipe.app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_server_only_supabase_secret
STRIPE_SECRET_KEY=sk_test_key_for_first_deployment
STRIPE_WEBHOOK_SECRET=whsec_from_the_public_endpoint_for_this_environment
# Admin dashboard, optional: /admin shows a setup message until both are set. See section 7.
SUPABASE_PUBLISHABLE_KEY=sb_publishable_from_supabase_api_keys
ADMIN_EMAILS=founder1@example.com,founder2@example.com
```

Keep the secret values (`SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the §8 Telegram/Anthropic keys) in Dokploy's runtime environment settings, not in Git or Docker build arguments. There are no `NEXT_PUBLIC_` secrets. The `STRIPE_WEBHOOK_SECRET` printed by a local `stripe listen` session is for local testing only; create a separate signing secret for the deployed endpoint.

## 4a. Observability (optional)

Sentry (errors), PostHog (product analytics) and `GET /api/health` are built in. Every variable below is optional: with none set, Sentry and PostHog stay off and the build still succeeds. Use **dedicated NoSwipe projects** in both tools. Do not reuse a project or organization that belongs to anything else.

| Variable | Where in Dokploy | Secret? | Where to get it |
| --- | --- | --- | --- |
| `SENTRY_DSN` | Environment (runtime) | no | Sentry → create a Next.js project named `noswipe` → **Settings → Client Keys (DSN)**. Enables server and edge error capture. |
| `NEXT_PUBLIC_SENTRY_DSN` | Build-time Arguments | no (public) | Same DSN as above. Enables browser error capture. Inlined into the bundle at build time, so changing it needs a redeploy. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Build-time Arguments | no | Optional label, e.g. `production` (default) or `staging`. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Build-time Arguments | no (public) | PostHog → create a project named `NoSwipe` → **Project settings → Project API key** (`phc_…`). |
| `NEXT_PUBLIC_POSTHOG_HOST` | Build-time Arguments | no | `https://us.i.posthog.com` for US Cloud (default) or `https://eu.i.posthog.com` for EU Cloud. |
| `SENTRY_AUTH_TOKEN` | Build-time **Secrets** | **yes** | Sentry → **Settings → Developer Settings → Organization Tokens** (only scope: source-map upload). Used only to upload source maps at build time. |
| `SENTRY_ORG` | Build-time Arguments | no | Sentry organization slug (from the URL `sentry.io/organizations/<slug>/`). |
| `SENTRY_PROJECT` | Build-time Arguments | no | Sentry project slug, e.g. `noswipe`. |
| `GIT_SHA` | Build-time Arguments | no | Commit SHA of the deploy. `/api/health` reports it as `version`, and Sentry uses it as the release name. |

Notes:

- `NEXT_PUBLIC_*` values are public by design. A Sentry DSN and a PostHog project key can only send data, not read it. They are still build-time values because Next.js inlines them into the browser bundle.
- `SENTRY_AUTH_TOKEN` is read from an optional BuildKit secret with id `SENTRY_AUTH_TOKEN` (`docker build --secret id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN`). Never pass it as a build argument. Source maps are uploaded only when the token, `SENTRY_ORG` and `SENTRY_PROJECT` are all present. They are deleted from the image after upload, and a failed upload logs a warning rather than failing the build.
- **The image must be built with BuildKit.** The `Dockerfile` starts with `# syntax=docker/dockerfile:1` and uses `RUN --mount=type=secret,...,required=false`, which the legacy builder cannot parse. BuildKit is the default `docker build` backend since Docker Engine 23, so a current Dokploy server needs no change. If the build fails with `the --mount option requires BuildKit`, upgrade Docker on the server or enable BuildKit with `"features": { "buildkit": true }` in `/etc/docker/daemon.json`. The secret itself stays optional: with BuildKit but no `SENTRY_AUTH_TOKEN` secret configured, the mount is empty and the build succeeds without uploading source maps.
- Privacy defaults (in code): Sentry collects no user info, cookies, request or response bodies, or stack-frame variables. It samples 10% of traces and redacts email addresses, Checkout session ids and Telegram bot tokens from events, spans and breadcrumbs. PostHog runs with `person_profiles: identified_only`, no autocapture, all inputs masked, session recording off, and Do Not Track respected, and it never runs on `/admin` pages (which include the concierge console at `/admin/concierge`). In PostHog **Project settings**, also turn on **Discard client IP data**.
- Health check: `GET /api/health` returns `{ ok, version, time, checks: { supabase } }`. It returns 200 when Supabase answers within 2 seconds and 503 otherwise (`timeout`, `error` or `unconfigured`). It never includes hosts, keys or error messages.

## 5. Register the public Stripe webhook

In the matching Stripe test or live mode, create a **snapshot** webhook destination for **Your account** at:

```text
https://noswipe.app/api/stripe/webhook
```

For the first deployment, create this destination in **Stripe test mode**. Subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `charge.refunded`. Reveal that destination's `whsec_...` signing secret, set it as `STRIPE_WEBHOOK_SECRET` in Dokploy, and redeploy the Application.

## 6. Verify before accepting live payments

Open the deployed HTTPS site, reserve with a test email, and complete a Stripe test-mode $1 Checkout with card `4242 4242 4242 4242`. Confirm the page shows a waitlist number and Stripe reports a successful delivery to the deployed webhook. Check the corresponding Supabase reservation is `paid` with one queue position. Also cancel a new Checkout to confirm the unpaid path.

Test and live Stripe payments should not share the same launch queue. Use a separate Supabase project for staging or clear only your test reservations and reset the counter before switching the same project to live payments. Replace both Stripe keys with live-mode values and create a live-mode webhook destination when you are ready to accept real $1 payments.

The app needs a configured support contact and payment receipts in Stripe before public launch, because the privacy and reservation terms refer customers to that contact.

## 7. Admin dashboard

`/admin` shows the funnel (KPIs, a 30-day chart, conversion by variant and `utm_campaign`) and `/admin/leads` lists reservations with filters, a detail page per lead with a stage and notes, and a CSV export at `/admin/leads/export`. Only the founders can open it.

1. **SQL.** In the Supabase SQL editor, apply [`supabase/2026-10-23-funnel-tracking.sql`](supabase/2026-10-23-funnel-tracking.sql) if it isn't already, then [`supabase/2026-10-23-admin.sql`](supabase/2026-10-23-admin.sql). Both are idempotent. The admin file adds the `lead_notes` table and three read-only report functions; RLS is on and only `service_role` gets access.
2. **Env.** In Dokploy, add `SUPABASE_PUBLISHABLE_KEY` (Supabase → Project Settings → API Keys → publishable key; the legacy `anon` key works too and can be set as `SUPABASE_ANON_KEY` instead) and `ADMIN_EMAILS`, a comma-separated list of the founders' emails. Both are server-only. Never add a `NEXT_PUBLIC_` copy. `SITE_URL` (§4) is required too: every sign-in link is built from it, never from request headers, so it must be the public HTTPS origin. Redeploy. Until all of them are set, `/admin` shows a setup message naming what's missing.
3. **Supabase Auth.**
   - **Create the admin users by hand.** The sign-in form never creates accounts (`shouldCreateUser: false`). Under Authentication → Users → **Add user** → **Send invitation** (or **Create new user** with **Auto Confirm User** ticked), add each `ADMIN_EMAILS` address. A founder who isn't added here gets no email.
   - **Disable public signups.** Under Authentication → Sign In / Providers, turn off **Allow new users to sign up**. Keep the **Email** provider enabled.
   - **Keep "Confirm email" on** (same page). `/admin` only accepts a user whose email is confirmed *and* on `ADMIN_EMAILS`, so an unconfirmed account that claims a founder's address gets nothing.
   - Under Authentication → URL Configuration, set **Site URL** to `SITE_URL` and add `https://morrow.zulfkhar.dev/admin/auth/callback` (and the noswipe.app equivalent once it's live) to **Redirect URLs**.
   - **Who sends the email.** With `RESEND_API_KEY` and `EMAIL_FROM` set (§9), the app sends the sign-in email itself, from NoSwipe through Resend (`src/lib/admin-login-email.ts`): it looks the user up with the service key, calls `auth.admin.generateLink({ type: "magiclink" })` only for a confirmed, allowlisted user, and emails a `SITE_URL/admin/auth/callback?token_hash=…&type=email` link plus the one-time code. Supabase sends nothing. Only while Resend is unset does the form fall back to Supabase's own mailer, so set the Supabase templates (Authentication → Emails) to NoSwipe-branded ones as a backstop. The Magic Link body should use this link shape so it works in any browser and the code works on any device:

   ```html
   <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
   <p>Or enter this code: <strong>{{ .Token }}</strong></p>
   ```

   Supabase's built-in email sender is limited to a few emails an hour and sends from a Supabase address; custom SMTP (Authentication → Emails → SMTP: `smtp.resend.com`, port 465, user `resend`, password = a Resend API key, sender name NoSwipe) fixes both for any email Supabase still sends.
4. **Sign in.** Open `/admin`, enter an allowlisted email, then click the link or type the code. Sign-in emails are only sent to `ADMIN_EMAILS` addresses that already exist as users; the form shows the same message for any address. A signed-in account that is not on the list, or whose email isn't confirmed, gets a 404 on every admin page and on the CSV export.

Every admin page, server action and the export check the session, a confirmed email and `ADMIN_EMAILS` on the server (shared helpers in `src/lib/admin-auth.ts`). Data is read with the server's `SUPABASE_SECRET_KEY`; the publishable key is used only to manage the sign-in session, whose cookies are `httpOnly` and scoped to `/admin`. Logs carry error codes only, never emails or notes.

## 8a. The NoSwipe app (login, onboarding, chats, dates, admin clients)

`/login`, `/onboarding`, `/home`, `/chats`, `/dates`, `/profile` are the signed-in app; `/demo` is a public, labelled showcase; `/admin/clients` is where the team sets app status and adds matches, messages and dates for each client. Nothing in the app invents data: real users see only their own rows, and the automation that creates app accounts and chats is built separately (see [`docs/automation.md`](docs/automation.md)).

**Database.** Run [`supabase/2026-11-04-app.sql`](supabase/2026-11-04-app.sql) in the Supabase SQL editor (or through the Management API), after `schema.sql`. It is idempotent: tables `profiles`, `profile_photos`, `preferences`, `consents`, `app_accounts`, `matches`, `messages`, `takeovers`, `dates`, RLS on everywhere, browser roles revoked (signed-in users get SELECT on their own rows only; every write goes through the server with the service key), a trigger that stops AI messages in a taken-over chat, the private `profile-photos` bucket (owner + service role only) and the Realtime publication. Then run the RLS checks, which always roll back:

```sh
SUPABASE_PAT=... SUPABASE_PROJECT_REF=... node scripts/run-app-rls-test.mjs   # prints "RLS tests passed (rolled back)"
```

**Auth.** Keep **Allow new users to sign up** switched off in Supabase: the app creates accounts itself on the server (`auth.admin.createUser`, email pre-confirmed) when someone asks for a sign-in code, and sends the email through Resend (§9: `RESEND_API_KEY` and `EMAIL_FROM` are required for sign-in). The user session lives in its own `ns-session` cookie (path `/`), separate from the founders' `/admin` cookie. Add `https://www.noswipe.app/auth/callback` and `https://noswipe.app/auth/callback` to **Redirect URLs** only if you also use Supabase's own mailer; our links are verified server-side by token hash and do not need it.

**Environment** (Vercel project settings, runtime only, never `NEXT_PUBLIC_`): everything in §4 and §9, plus

```dotenv
AUTOMATION_API_KEY=...   # 32+ random characters (openssl rand -hex 32). Bearer key for /api/automation/v1. Unset = the API answers 503.
ANTHROPIC_API_KEY=sk-ant-...   # used by the automation worker, never by the browser
```

`SUPABASE_PUBLISHABLE_KEY` is handed to a signed-in browser at runtime by `/api/app/realtime` (it is public by design); the browser never sees the secret key.

**Realtime.** Chats and the home page update live through Supabase Realtime using the user's own token, so RLS decides what streams. If Realtime is unreachable the app falls back to refreshing every 20 seconds.

**Deleting an account** (Profile → Delete account) removes the user's photos from storage and the auth user; every table row cascades from `auth.users`.

**Legal.** `/privacy` and `/terms` describe this data use. They have not had a lawyer review yet; get one before real users come in volume.

## 8. Concierge pilot (Telegram bot, drafting, console)

Everything below is optional. Each part switches itself off while its variables are missing. The console at `/admin/concierge` uses the admin sign-in from §7 (same `ADMIN_EMAILS`, same users, same callback), so set up §7 first.

**Database.** Run [`supabase/2026-10-23-concierge.sql`](supabase/2026-10-23-concierge.sql) in the Supabase SQL editor, after `schema.sql`. It is idempotent: re-running it on an older install adds the `sending` status, the `send_started_at` column and the retention function. It enables RLS, revokes all browser roles, and grants only `service_role`.

**Retention (30 days).** `public.purge_old_drafts()` deletes drafts (input summary, draft text, operator notes) older than 30 days and returns how many it removed. It is `security definer`, and only `service_role` may execute it. Schedule it daily with pg_cron (Supabase → Integrations → Cron, or Database → Extensions → enable `pg_cron`), then run this once in the SQL editor:

```sql
select cron.schedule('purge-concierge-drafts', '17 4 * * *', $$select public.purge_old_drafts()$$);
```

Check it with `select * from cron.job_run_details order by start_time desc limit 5;`. Without pg_cron, run `select public.purge_old_drafts();` by hand at least once a week. The privacy page promises 30 days, so don't skip this.

**Create the bot.** In Telegram, message [@BotFather](https://t.me/BotFather): send `/newbot`, choose a name and a username ending in `bot`, and copy the token. Then send `/setjoingroups` and choose Disable (the bot only handles private chats). Optionally set `/setdescription`.

**Environment** (Dokploy → Environment, runtime only, never `NEXT_PUBLIC_`), in addition to the §7 variables:

```dotenv
TELEGRAM_BOT_TOKEN=123456:token_from_botfather
TELEGRAM_WEBHOOK_SECRET=output_of_openssl_rand_hex_32
TELEGRAM_BOT_USERNAME=your_bot_username
ANTHROPIC_API_KEY=sk-ant-...
```

Generate the webhook secret with `openssl rand -hex 32`. Redeploy after setting the variables.

**Register the webhook** once the HTTPS domain is live. Telegram sends the secret in the `X-Telegram-Bot-Api-Secret-Token` header, and the app rejects any request without it:

```sh
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d url="https://noswipe.app/api/telegram/webhook" \
  -d secret_token="$TELEGRAM_WEBHOOK_SECRET" \
  -d 'allowed_updates=["message"]' \
  -d drop_pending_updates=true
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Use the domain the app actually serves (`https://morrow.zulfkhar.dev` until the move), and re-run `setWebhook` with the new URL after a domain change.

**Check it.** Sign in at `/admin/login`, open **Concierge → Clients**, create an invite, open the invite link on your phone, and send a screenshot captioned `opener`. The bot should acknowledge it, a draft should appear in the queue within a minute, and **Approve & send** should deliver it to the chat once. `getWebhookInfo` should show no `last_error_message`.

## 9. Confirmation email (Resend)

Optional. When a $1 reservation is paid, the Stripe webhook sends one email: subject "You're #N in line at NoSwipe", plain text plus simple HTML, sent through [Resend](https://resend.com) with a plain `fetch` (`src/lib/email.ts`, content in `src/lib/confirmation-email.ts`). While `RESEND_API_KEY` or `EMAIL_FROM` is unset, nothing is sent and nothing is logged. A Resend failure is logged as a status code only (never the address or content) and never fails the webhook.

**Database.** Run [`supabase/2026-10-23-confirmation-email.sql`](supabase/2026-10-23-confirmation-email.sql) after `schema.sql`. It adds `reservations.confirmation_email_sent_at`, which the webhook claims with a conditional update before sending, so each reservation gets the email at most once even if Stripe redelivers. Until it is applied, the webhook still sends, but only on the first delivery of the `paid` funnel event (`funnel_events.dedupe_key`), and every send carries a Resend `Idempotency-Key` per reservation.

**Verify the domain in Resend.** Resend → Domains → Add domain → `noswipe.app` (region us-east-1). Resend shows the DNS records to add; in Namecheap → Domain List → `noswipe.app` → Advanced DNS add each one exactly as shown, as host records (Namecheap appends `.noswipe.app` itself, so enter only the host part, e.g. `resend._domainkey`, `send`):

- **TXT** `resend._domainkey`: the DKIM public key.
- **MX** `send`: `feedback-smtp.us-east-1.amazonses.com`, priority 10 (bounce handling for the `send.` subdomain only). In Namecheap, MX records live under Advanced DNS → **Mail Settings → Custom MX**, which switches off Namecheap's free email forwarding for the domain (see Replies below).
- **TXT** `send`: `v=spf1 include:amazonses.com ~all`.
- Recommended: **TXT** `_dmarc`: `v=DMARC1; p=none;`.

Click **Verify** in Resend; it usually turns green within minutes, up to a few hours. Then create an API key with **Sending access** for that domain only.

**Replies.** The footer tells people to reply. Resend only sends, and Custom MX turns off Namecheap forwarding, so nothing receives `hi@noswipe.app` by default. Set `EMAIL_REPLY_TO` to an inbox a founder reads, or add an inbound mail provider's MX records for the root host (`@`) alongside the `send` one.

**Environment** (hosting provider's server env, runtime only, never `NEXT_PUBLIC_`):

```dotenv
RESEND_API_KEY=re_...
EMAIL_FROM=NoSwipe <hi@noswipe.app>
# optional
EMAIL_REPLY_TO=
```

Redeploy after setting them. **Check it** with a Stripe test-mode reservation using an address you can read: the email should arrive once, `confirmation_email_sent_at` should be set on the row, and resending the same event from the Stripe dashboard (Workbench → Events → Resend) should not send a second email.

## 10. Admin videos (posting queue)

`/admin/videos` shows the @noswipe.app posting queue: up next (Pacific times), needs fixes, posted (Instagram link), failed/skipped. Either founder can request **Post anyway** on a needs-fixes video or **Don't post** on a scheduled one.

1. Apply `supabase/2026-10-25-content-posts.sql` (tables `content_posts` + `content_actions`, RLS on, service role only, and the private `content-previews` bucket).
2. Set `CONTENT_SYNC_TOKEN` (32+ random characters) in the production environment and redeploy.

An external sync job owned by the founders calls `POST /api/content/sync` every 5 minutes with that bearer token. It upserts every video, uploads previews through one-time signed upload URLs, receives the open requests, applies them to the queue, and reports them done on the next call. The page only reads; previews are served as 10-minute signed URLs.

## Free /try tool

`/try` and `/api/try` run as a Vercel serverless function and use `ANTHROPIC_API_KEY` plus the Supabase server key. Apply `supabase/2026-11-02-try-tool.sql` first (idempotent; adds `try_runs`, the claim/release/usage functions and the `try_*` funnel events; run it after any other migration that rewrites `funnel_events_event_check`). Optional env (Vercel project settings, runtime only, never `NEXT_PUBLIC_`), all with safe defaults:

```dotenv
TRY_DAILY_CAP=300              # global free runs per UTC day, then "come back tomorrow"
TRY_DAILY_TOKEN_CAP=8000000    # hard daily spend ceiling in input-token equivalents (input + 5 x output); releasing a run never refunds it
TRY_SESSION_DAILY_LIMIT=3      # per browser per day
TRY_IP_DAILY_LIMIT=6           # per IP hash per day (IPv6 is hashed by /64)
TRY_HASH_SALT=...              # salt for IP/session hashes (falls back to the Supabase key)
```

Limits live in Supabase because serverless instances do not share memory. If the database or the migration is unavailable, `/api/try` fails closed and shows "temporarily unavailable". Request bodies are capped at 4.4 MB (Vercel rejects over 4.5 MB); the browser keeps uploads under about 3.8 MB. Images are never stored or logged.
