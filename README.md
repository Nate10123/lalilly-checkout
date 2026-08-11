# LA LILLY — Taking Real Orders (Free Setup)

This site now has a real cart that checks out through **Stripe Checkout**.
Nothing costs money to set up — Stripe only takes its standard cut
(2.9% + 30¢) when a sale actually happens. Netlify's free tier covers the
hosting and the serverless function.

## How it works

- The page (`index.html`) is your storefront — unchanged visually.
- When someone clicks **Checkout**, the browser calls a small server
  function (`netlify/functions/create-checkout-session.js`).
- That function builds the order **using prices stored on the server**
  (never trusting the browser) and asks Stripe for a real, hosted checkout
  page, then sends the customer there.
- After payment, Stripe redirects them to `success.html`.
- Behind the scenes, Stripe also calls a second function,
  `netlify/functions/stripe-webhook.js`, the moment payment succeeds. That
  function automatically places the matching order with **Printful**, so
  it goes into production and ships without you touching anything.

You never see or touch card numbers — Stripe's hosted page handles all of
that, which also means you don't have to worry about PCI compliance.

## Product catalog

Both functions now share one file, `netlify/functions/products.js` — this
is the single place to update prices, add products, or (most importantly
for Printful) fill in each product's `printfulVariantId`.

## One-time setup (about 15 minutes)

### 1. Create a Stripe account
Go to [stripe.com](https://stripe.com) and sign up. Free, no monthly fee.

### 2. Get your secret API key
In the Stripe Dashboard: **Developers → API keys**. Copy the **Secret key**
(starts with `sk_test_...` while testing, `sk_live_...` once you're ready
for real payments). Keep this private — never put it in the HTML/JS.

### 3. Push this project to GitHub
Create a new repo and upload this whole folder (keep the folder structure —
`netlify/functions/` must stay intact).

### 4. Deploy to Netlify
- Go to [netlify.com](https://netlify.com) → **Add new site → Import from
  GitHub** → pick your repo.
- Build settings: leave the defaults (this project has a `netlify.toml`
  that tells Netlify where the function lives).

### 5. Add your Stripe key as an environment variable
In Netlify: **Site settings → Environment variables → Add variable**
- Key: `STRIPE_SECRET_KEY`
- Value: your secret key from step 2

Redeploy the site after adding it (Netlify usually prompts you to).

### 6. Test the payment
Use Stripe's test card `4242 4242 4242 4242`, any future expiry date, any
CVC. Add items to your cart and hit Checkout — you should land on a real
Stripe payment page, then get redirected to `success.html`.

## Connect Printful (automatic fulfillment)

### 1. Create a free Printful account
[printful.com](https://printful.com) — free, no monthly fee. You only pay
per item when something actually gets produced and shipped.

### 2. Sync your products in Printful
In the Printful dashboard: **Store → Products → New product**. Pick the
blank item (hat, tee, etc.), upload your design, choose size/color. Do
this for each of your 8 products.

### 3. Find each product's Sync Variant ID
Open a synced product, click into a specific size/color variant — the
numeric **variant ID** is shown in the variant details. Copy it.

### 4. Fill in `netlify/functions/products.js`
For each product, replace `printfulVariantId: null` with the real number
you copied. This is what tells Printful exactly what to print — orders
will fail without it.

### 5. Get your Printful API key
Printful dashboard → **Settings → Stores** → select your store →
**API** → generate a token.

### 6. Set up the Stripe webhook
This is what triggers automatic fulfillment. In the Stripe Dashboard:
**Developers → Webhooks → Add endpoint**
- Endpoint URL: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
- Event to send: `checkout.session.completed`
- After creating it, copy the **Signing secret** (starts with `whsec_...`)

### 7. Add the remaining environment variables in Netlify
**Site settings → Environment variables**, add:
- `PRINTFUL_API_KEY` — from step 5
- `STRIPE_WEBHOOK_SECRET` — from step 6
- `PRINTFUL_STORE_ID` — only needed if your Printful token covers
  multiple stores

Redeploy after adding these.

### 8. Do a real test order
With Stripe still in **test mode**, place a test order end to end. Check
your function logs in Netlify (**Functions** tab) to confirm the Printful
order was created — and check your Printful dashboard's **Orders** tab.
It's worth setting `confirm: false` in `stripe-webhook.js` for this first
test, so the order sits as a draft in Printful you can inspect (instead of
immediately going to print) before switching it back to `true`.

### 9. Go live
Switch Stripe to **live mode** (its own key + its own webhook, so redo
steps 2 and 6 for live mode), update the environment variables, and you're
taking real orders that fulfill themselves.

## Shipping & taxes (optional next steps)

- Shipping rates: add a `shipping_options` array to the `stripe.checkout.
  sessions.create()` call in the function.
- Sales tax: enable **Stripe Tax** in the Dashboard and add
  `automatic_tax: { enabled: true }` to the same call.

## Where orders show up

Every paid order appears in your Stripe Dashboard under **Payments**
(money) and in your Printful dashboard under **Orders** (physical
fulfillment) — Printful handles printing, packing, and shipping under
your brand, and pushes tracking info back once it ships.

## A couple of things worth knowing

- **Test in Printful's sandbox mindset first.** Leave `confirm: false`
  until you've watched at least one order flow through correctly — a
  wrong variant ID means printing (and paying for) the wrong product.
- **Sizes:** this starter treats each storefront product as one fixed
  size. If you want size pickers, each size needs its own
  `printfulVariantId`, and the storefront's Add-to-Cart would need to
  pass the chosen size through as its own product ID.
- **Failed fulfillment isn't invisible.** If Printful rejects an order
  (bad address, missing variant), it's logged in Netlify's function logs
  but the customer's already been charged — check those logs periodically,
  at least until you've got some order volume under your belt.
