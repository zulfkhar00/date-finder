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
   - Under Authentication → Emails → **Magic Link**, replace the body with this, so the link works in any browser and the code works on any device:

   ```html
   <h2>Sign in to NoSwipe admin</h2>
   <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
   <p>Or enter this code: <strong>{{ .Token }}</strong></p>
   ```

   The default template also works, but only in the browser that requested the link. Supabase's built-in email sender is limited to a few emails an hour; set up custom SMTP (Authentication → Emails → SMTP) if you hit that.
4. **Sign in.** Open `/admin`, enter an allowlisted email, then click the link or type the code. Sign-in emails are only sent to `ADMIN_EMAILS` addresses that already exist as users; the form shows the same message for any address. A signed-in account that is not on the list, or whose email isn't confirmed, gets a 404 on every admin page and on the CSV export.

Every admin page, server action and the export check the session, a confirmed email and `ADMIN_EMAILS` on the server (shared helpers in `src/lib/admin-auth.ts`). Data is read with the server's `SUPABASE_SECRET_KEY`; the publishable key is used only to manage the sign-in session, whose cookies are `httpOnly` and scoped to `/admin`. Logs carry error codes only, never emails or notes.

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
