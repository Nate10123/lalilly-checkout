# LA LILLY — How This Site Works

Static storefront, real Stripe checkout, automatic fulfillment through
Printful and/or Printify, hosted on **Cloudflare Pages**. Nothing here
costs a platform fee — Stripe takes its standard cut (2.9% + 30¢) per sale,
and you pay Printful/Printify only when an item actually gets produced and
shipped. Every product picks one provider (see "Adding a Printify product"
below) — a single cart can include items from both, and each gets its own
order placed automatically.

## Structure

- `index.html`, `shop.html`, `product.html`, `success.html` — the pages
- `store.js` — shared product catalog, cart logic, and pricing (used by
  every page)
- `style.css` — shared styling
- `assets/` — your logo and brand emblem
- `functions/api/create-checkout-session.js` — creates the Stripe Checkout
  session when someone clicks Checkout
- `functions/api/stripe-webhook.js` — runs the moment a payment succeeds;
  places the matching order(s) with Printful and/or Printify automatically
- `functions/api/printify-webhook.js` — Printify's equivalent of
  `printful-webhook.js`; records the tracking number once a Printify item ships
- `functions/_shared/products.js` — the server's source of truth for
  prices and provider variant IDs (never trusts the browser)
- `functions/_shared/printify.js` — builds and places the Printify order
  (Printful's equivalent lives inline in `stripe-webhook.js`)
- `wrangler.toml` — tells Cloudflare this is a Pages project and sets the
  Node compatibility flag Stripe's SDK needs

## Adding or updating a product

1. Edit `store.js` — add the product to the `PRODUCTS` array (name, price,
   category, image URL, description, and `sizes`/`sizePricing` if it has
   size options).
2. Edit `functions/_shared/products.js` — same product, but this is where
   the *real* price and Printful `sync_variant_id`(s) live for actual
   checkout and fulfillment. Get variant IDs via Printful's API (the
   dashboard's displayed ID isn't the right format — see below).

Both files need to agree on product `id` numbers and prices, since one
drives what the customer sees and the other drives what they're actually
charged and what gets fulfilled.

## Finding a Printful variant ID

Printful's dashboard shows a hex-style ID that **won't work** here. Get
the real numeric ID via the API instead:

```
GET https://api.printful.com/store/products
Authorization: Bearer YOUR_PRINTFUL_TOKEN
```

Find your product's numeric `id`, then:

```
GET https://api.printful.com/store/products/{that_id}
```

Each entry in `sync_variants` has an `id` field — that's the real
`sync_variant_id` to use in `products.js`.

## Adding a Printify product

New products can go through Printify instead of Printful — existing
products stay on Printful untouched. In `functions/_shared/products.js`,
give the product:

- `provider: 'printify'`
- `printifyProductId` — the product's own id, from
  `GET https://api.printify.com/v1/shops/{shop_id}/products.json`
  (Authorization: `Bearer YOUR_PRINTIFY_TOKEN`)
- variant IDs in `sizes` / `variantsByColor` / `printifyVariantId` (same
  shape as a Printful product) — each variant's numeric `id` from that same
  products response

Everything else (pricing in `products.js` and `store.js`, the shape of
`sizes`/`colors`, etc.) works exactly like a Printful product.

## Environment variables (set in Cloudflare Pages → Settings → Environment variables)

- `STRIPE_SECRET_KEY`
- `PRINTFUL_API_KEY`
- `PRINTFUL_STORE_ID` (only if your Printful token spans multiple stores)
- `PRINTIFY_API_KEY` — a Personal Access Token from Printify → My Account →
  Connections
- `PRINTIFY_SHOP_ID` — from `GET https://api.printify.com/v1/shops.json`
- `PRINTIFY_WEBHOOK_SECRET` — a random string you make up yourself (like
  `PRINTFUL_WEBHOOK_SECRET`), used when you register the webhook below
- `STRIPE_WEBHOOK_SECRET` (from your Stripe webhook destination)
- `ENABLE_STRIPE_TAX` — set to `true` once you've activated Stripe Tax in
  your Stripe Dashboard; leave unset until then
- `BREVO_API_KEY` — from a free Brevo account (brevo.com), under SMTP & API
  → API Keys. Powers the newsletter signup form.
- `BREVO_LIST_ID` — the numeric ID of the contact list you want signups
  added to (Contacts → Lists in Brevo, or the "Get all lists" API endpoint).

Set these for **both** Production and Preview environments.

## Newsletter signup

The newsletter form (`handleSignup()` in `store.js`) posts to
`functions/api/newsletter-signup.js`, which adds the email to a Brevo list
server-side — your API key never reaches the browser. Brevo's free plan
covers unlimited contacts and about 9,000 emails/month, which is plenty for
occasional drop announcements. To actually send a newsletter, compose and
send a campaign from the Brevo dashboard to that list — this integration
only handles collecting signups, not sending campaigns.

## Going live for real

Fulfillment currently runs in draft mode for both providers — Printful
orders use `confirm: false` in `stripe-webhook.js`, and Printify orders
just aren't sent to production automatically (that's Printify's default;
nothing here needs to change for that). Both land for you to review first.
Once you trust the Printful pipeline, flip `confirm` to `true`; for
Printify, you'd call `POST /orders/{id}/send_to_production.json` yourself
(manually, or by adding that call to `_shared/printify.js`) once you trust it.

Also: this is still on Stripe **test mode**. Going live means a live
Stripe secret key, a second (live-mode) webhook destination, and updating
the environment variables above with the live values.

## Deploying changes

Push to the connected GitHub repo's `main` branch — Cloudflare Pages
rebuilds and redeploys automatically.
