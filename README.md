# LA LILLY — How This Site Works

Static storefront, real Stripe checkout, automatic Printful fulfillment,
hosted on **Cloudflare Pages**. Nothing here costs a platform fee — Stripe
takes its standard cut (2.9% + 30¢) per sale, and you pay Printful only
when an item actually gets produced and shipped.

## Structure

- `index.html`, `shop.html`, `product.html`, `success.html` — the pages
- `store.js` — shared product catalog, cart logic, and pricing (used by
  every page)
- `style.css` — shared styling
- `assets/` — your logo and brand emblem
- `functions/api/create-checkout-session.js` — creates the Stripe Checkout
  session when someone clicks Checkout
- `functions/api/stripe-webhook.js` — runs the moment a payment succeeds;
  places the matching order with Printful automatically
- `functions/_shared/products.js` — the server's source of truth for
  prices and Printful variant IDs (never trusts the browser)
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

## Environment variables (set in Cloudflare Pages → Settings → Environment variables)

- `STRIPE_SECRET_KEY`
- `PRINTFUL_API_KEY`
- `PRINTFUL_STORE_ID` (only if your Printful token spans multiple stores)
- `STRIPE_WEBHOOK_SECRET` (from your Stripe webhook destination)
- `ENABLE_STRIPE_TAX` — set to `true` once you've activated Stripe Tax in
  your Stripe Dashboard; leave unset until then

Set these for **both** Production and Preview environments.

## Going live for real

Fulfillment currently runs in draft mode (`confirm: false` in
`stripe-webhook.js`) — orders land in Printful for you to review, not
straight to production. Once you trust the pipeline, change it to `true`.

Also: this is still on Stripe **test mode**. Going live means a live
Stripe secret key, a second (live-mode) webhook destination, and updating
the environment variables above with the live values.

## Deploying changes

Push to the connected GitHub repo's `main` branch — Cloudflare Pages
rebuilds and redeploys automatically.
