# Deploy Morrow with Dokploy

The app runs as one Next.js container and uses the existing hosted Supabase project. The included `Dockerfile` builds Next.js standalone output and serves it on port 3000.

## 1. Push a private GitHub repository

Create an empty **private** repository on GitHub, then push this project's `main` branch. Do not initialize the GitHub repository with a README, license, or `.gitignore`; those files are already in this project. From this directory, run:

```sh
git remote add origin https://github.com/YOUR_ACCOUNT/morrow-concierge.git
git push -u origin main
```

The repository excludes `.env.local`, build output, and local test artifacts. Confirm the GitHub repository is private before connecting it to Dokploy.

## 2. Create the Dokploy Application

In Dokploy, open **Git**, select **GitHub**, and create and install the Dokploy GitHub App. Grant it access to the private repository. In your Dokploy project, create an **Application**, select the GitHub source, the repository, and branch `main`. Set the build path to `/`, **Build Type** to **Dockerfile**, **Dockerfile Path** to `Dockerfile`, and **Docker Context Path** to `.`. Deploy the application. Dokploy can redeploy when new commits are pushed to `main`. The container listens on port `3000`. The image needs no persistent volume because reservation data lives in Supabase.

## 3. Connect the domain

Point the `morrow.zulfkhar.dev` DNS record to your IONOS server. In the application's **Domains** tab, set the host to `morrow.zulfkhar.dev`, path `/`, container port `3000`, enable HTTPS, and select Let's Encrypt. Wait for a valid certificate before creating a public Stripe webhook.

## 4. Set runtime environment variables

Add these in the Dokploy application's **Environment** tab. Use the exact deployed HTTPS origin for `SITE_URL`, with no path:

```dotenv
SITE_URL=https://morrow.zulfkhar.dev
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_server_only_supabase_secret
STRIPE_SECRET_KEY=sk_test_key_for_first_deployment
STRIPE_WEBHOOK_SECRET=whsec_from_the_public_endpoint_for_this_environment
```

Keep all three secret values in Dokploy's runtime environment settings, not in Git or Docker build arguments. There are no `NEXT_PUBLIC_` secrets. The `STRIPE_WEBHOOK_SECRET` printed by a local `stripe listen` session is for local testing only; create a separate signing secret for the deployed endpoint.

## 5. Register the public Stripe webhook

In the matching Stripe test or live mode, create a **snapshot** webhook destination for **Your account** at:

```text
https://morrow.zulfkhar.dev/api/stripe/webhook
```

For the first deployment, create this destination in **Stripe test mode**. Subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `charge.refunded`. Reveal that destination's `whsec_...` signing secret, set it as `STRIPE_WEBHOOK_SECRET` in Dokploy, and redeploy the Application.

## 6. Verify before accepting live payments

Open the deployed HTTPS site, reserve with a test email, and complete a Stripe test-mode $1 Checkout with card `4242 4242 4242 4242`. Confirm the page shows a waitlist number and Stripe reports a successful delivery to the deployed webhook. Check the corresponding Supabase reservation is `paid` with one queue position. Also cancel a new Checkout to confirm the unpaid path.

Test and live Stripe payments should not share the same launch queue. Use a separate Supabase project for staging or clear only your test reservations and reset the counter before switching the same project to live payments. Replace both Stripe keys with live-mode values and create a live-mode webhook destination when you are ready to accept real $1 payments.

The app needs a configured support contact and payment receipts in Stripe before public launch, because the privacy and reservation terms refer customers to that contact.
