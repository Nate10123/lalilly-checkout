# Moving LA LILLY from Netlify to Cloudflare Pages

This is a genuinely new deployment, not a setting tweak — follow every step.

## Why this move

Netlify's free plan ran out of "credits" from the sheer number of redeploys
during setup (it charges per deploy, not per size of change). Cloudflare
Pages has no equivalent wall for a store this size, and — unlike Vercel's
free tier — explicitly permits commercial/e-commerce use.

## What changed in the code

- `functions/api/create-checkout-session.js` and `functions/api/
  stripe-webhook.js` — rewritten for Cloudflare's runtime (Web Fetch API
  instead of Node's request/response style, `context.env` instead of
  `process.env`).
- `functions/_shared/products.js` — same product data as before, just as
  an ES module import instead of CommonJS `require`.
- `store.js` — the checkout button now calls `/api/create-checkout-session`
  instead of `/.netlify/functions/create-checkout-session`.
- Your old `netlify/` folder and `netlify.toml` are still in this project,
  untouched — Cloudflare Pages just ignores them. Safe to delete later
  once you're confident in the new setup, not required now.

## One-time setup

### 1. Create a free Cloudflare account
[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) — no
credit card required.

### 2. Push this project to GitHub
Same repo you've been using is fine — just make sure ALL these new files
(the `functions/` folder, `wrangler.toml`) get uploaded alongside
everything else.

### 3. Create a Pages project
In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect
to Git**. Pick your `lalilly-checkout` repo.

### 4. Build settings
- Framework preset: **None**
- Build command: *(leave blank — this is a static site, nothing to build)*
- Build output directory: `/`

Click **Save and Deploy**.

### 5. Turn on Node compatibility (critical — checkout won't work without this)
Once the project exists: **Settings → Functions → Compatibility flags**.
Add `nodejs_compat` to **both** Production and Preview. This is the one
step people most often miss, since `wrangler.toml` alone doesn't reliably
cover it when deploying through the dashboard.

### 6. Add your environment variables
**Settings → Environment variables**. Add these (same values you already
have in Netlify — just copy them over), for both Production and Preview:
- `STRIPE_SECRET_KEY`
- `PRINTFUL_API_KEY`
- `STRIPE_WEBHOOK_SECRET` — **you'll generate a NEW one in step 8, this
  changes**
- `PRINTFUL_STORE_ID` (only if you were using this one)
- `ENABLE_STRIPE_TAX` (only if/when you turn on real tax collection)

### 7. Redeploy so the env vars and compatibility flag take effect
**Deployments → Retry deployment** on the latest one (or push a small
change to trigger a fresh build).

### 8. Point Stripe's webhook at the new URL
Your function's URL has changed. In Stripe (Developers → Webhooks), you
need a **new** destination — don't just edit the old one, since it's
still pointed at Netlify.
- Add destination → Webhook endpoint
- URL: `https://YOUR-PROJECT.pages.dev/api/stripe-webhook`
- Event: `checkout.session.completed`
- Copy the new signing secret (`whsec_...`) and put it in
  `STRIPE_WEBHOOK_SECRET` in Cloudflare (step 6), then redeploy again.

You can leave the old Netlify webhook destination in Stripe for now (it'll
just fail quietly since that site isn't being updated), or delete it once
you're confident the new one works.

### 9. Test everything, exactly like before
- Visit your new `.pages.dev` URL, add the tee to cart, pick a size,
  checkout with `4242 4242 4242 4242`.
- If checkout fails immediately: almost always the `nodejs_compat` flag
  (step 5) — double check it's really saved on both environments.
- If payment succeeds but Printful never gets the order: check
  **Cloudflare dashboard → your Pages project → Functions → Real-time
  Logs** (this is Cloudflare's equivalent of Netlify's function logs) for
  the `stripe-webhook` function, same debugging approach as before.

### 10. Custom domain (optional, once everything works)
**Custom domains → Set up a custom domain**, if you want something nicer
than `.pages.dev`.

## Going forward

Cloudflare Pages doesn't have Netlify's per-deploy credit system, but it's
still good practice to batch up several file changes into one upload
rather than redeploying after every tiny edit — mainly to keep your
deploy history clean, not because you'll hit a wall like before.
