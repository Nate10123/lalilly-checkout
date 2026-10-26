# La Lilly → WooCommerce → Tapstitch

Prepared against `Nate10123/lalilly-checkout`; updated onto base commit `a88f08e805fc68207371fdfa5b7ac702040b84d4` on October 24, 2026, preserving the newer hat image changes.
The free Oracle backend, DNS and HTTPS are deployed. One approved integration account has working authenticated API access. Its website consumer key, consumer secret and webhook secret are saved as encrypted Cloudflare production settings. Tapstitch is connected. The original ten-variant shirt passed an authorized unpaid sync test and a separate real Stripe sandbox checkout/retry/cancellation. On October 26 the owner replaced that deleted product with DTG design 1563930564392837120; its twelve newly published Woo variations were verified read-only. The old order tests are historical and have not been rerun for this replacement. The frontend candidate keeps Woo checkout disabled and the shirt Coming Soon; check the active Cloudflare commit before launch. No paid resource upgrade, supplier payment or production submission has been performed.

## Architecture found

The current store is static HTML/CSS/JavaScript on Cloudflare Pages. `store.js` and `product-extra.js` provide the visible catalog and a localStorage cart. Checkout posts only product IDs, sizes, colors and quantities to `/api/create-checkout-session`. The server catalog in `functions/_shared/products.js` plus `extra-products.js` determines prices and supplier IDs. Stripe Checkout collects payment and US/Canada shipping details. A signed Stripe webhook creates Printful/Printify orders, and Cloudflare KV (`ORDERS`) stores references for `/api/order-status` and `track.html`.

Printify references are in:

- `functions/_shared/products.js`: products **24** (Lilly Pug is calling Chain), **28** (The Pugg Stone Wash Heavy Tee), **29** (La Lilly Cut Keychain), plus provider/variant helpers.
- `functions/_shared/printify.js`: authenticated order creation; no send-to-production call.
- `functions/api/create-checkout-session.js`: existing variant and price validation.
- `functions/api/stripe-webhook.js`: provider splitting, Printify creation and KV references.
- `functions/api/printify-webhook.js`: signature verification and shipment lookup.
- `functions/api/order-status.js`: legacy and mixed-provider reference lookup.
- `store.js`, `README.md`: product display and setup documentation.

The existing implementation also uses Printful for most products. Its orders use `confirm: false`; Printify orders are created without a production submission call. Actual live Stripe mode and provider account settings cannot be determined from repository code.

## Resulting flow

```text
Existing lillypug.com UI and cart
  → existing Cloudflare checkout function
  → Stripe Checkout (existing payment provider)
  → verified paid Stripe webhook
  → WooCommerce REST API on https://store.lillypug.com
  → official Tapstitch connection
  → Tapstitch submission + supplier payment + production + shipment
  → WooCommerce order.updated webhook / authenticated status polling
  → existing Track Your Order page
```

The bridge is **off by default**. Existing products keep their providers. Frontend product **31**, **XYZ Camo Big Pug Head Tee** at the existing **$27.92**, now uses Tapstitch design **1563930564392837120**, blank **RU0001**, 200 gsm cotton and front/back DTG. It maps to Woo parent **30**, variations **35–46**: Black/White in S, M, L, XL, **2XL, 3XL**. The design’s selected **My clothing label**, 4 × 4 cm at $0.99 per garment, is Approved and was kept attached. This replaces the deleted parent 11; old paid snapshots and cancelled test orders were not rewritten. The exact size/color/SKU map is in `docs/woocommerce-variants.json` and `wrangler.toml`. The product is initially Coming Soon. With routing disabled or a missing mapping, Woo-only products fail before payment and cannot fall back to another supplier. WooCommerce handles order records, not a replacement public store or a second payment charge.

## Changed files and behavior

- `functions/_shared/woocommerce.js`: HTTPS-only authenticated REST client, explicit variant mapping, availability checks, immutable checkout snapshot, Stripe amount reconciliation, Woo import, tracking normalization.
- `functions/api/create-checkout-session.js`: preflight only for opted-in products; saves the Woo mapping/prices in KV before returning the Stripe URL. Keeps the existing `{url}` response and checkout page.
- `functions/api/stripe-webhook.js`: accepts paid completion/async-success events. Woo sessions take an isolated retryable path; legacy provider code remains intact.
- `functions/api/woocommerce-webhook.js`: base64 HMAC-SHA256 verification on the raw body, source/topic checks, authoritative authenticated reread. Unsigned registration pings cannot update orders.
- `functions/api/order-status.js`: understands Woo references and refreshes their status; keeps older Printful/Printify references working. Returns no addresses, email, order key or API credentials.
- `track.html`: same appearance; safely renders tracking text and HTTPS links, and labels cancellation/refund/failure accurately.
- `functions/_middleware.js`: prevents the repository-root static output from serving deployment material or local secret files.
- `deploy/woocommerce/`: WordPress + MariaDB + Caddy + cron + a required must-use order-import plugin.
- `.dev.vars.example`, `.gitignore`, `scripts/woocommerce-check.mjs`, `tests/`, `package.json`, `package-lock.json`, this guide and the README link.

Existing catalog entries, prices, supplier IDs, CSS and Printify webhook code are preserved. The selected shirt adds one entry to `product-extra.js` and the server extension catalog, four original mockups, and a product-specific international delivery note. `_headers` makes the extension catalog revalidate. `getProvider` and the legacy webhook explicitly prevent Woo-only products from reaching Printful/Printify. Layout and styling are unchanged.

## Why a small WordPress plugin is included

WooCommerce's ordinary order-create endpoint has no general idempotency guarantee. A search-before-create request or Cloudflare KV flag cannot prevent two simultaneous Stripe deliveries from creating duplicate supplier orders. The authenticated `wc/v3/lalilly-orders` endpoint serializes imports using a MariaDB named lock and recovers the same Woo order using a deterministic order key. It saves a pending order before building the lines, can rebuild an interrupted pending import, rejects changed payloads, and freezes the release decision on first import. A retry after completion never rebuilds lines, recharges payment, or downgrades an advanced/cancelled order.

Standard WooCommerce consumer keys authenticate both the ordinary REST routes and the bridge routes. A dedicated user must have `manage_woocommerce` (for example, a Shop Manager). The plugin uses Woo CRUD so HPOS is supported. Tapstitch still uses its official WooCommerce integration; there are no private Tapstitch API calls.

## Outside the repo: create the backend

1. In your own Oracle Cloud account, create an **Always Free eligible** VM in the home region, with an eligible boot volume and public IP. Do not upgrade the account or select paid/trial-only shapes or resources. Confirm the console shows $0 recurring cost for every resource before creating it. No load balancer is required. Oracle's current documented Ampere allowance is 1,500 OCPU-hours and 9,000 GB-hours/month (equivalent to 2 OCPUs/12 GB in an Always Free tenancy); use your account's displayed limits as authoritative. See [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
2. Install Docker Engine and the Compose plugin on the VM using the official instructions for its Linux distribution. This is a persistent VM workload, not Cloudflare Pages or a sleeping free web app.
3. In your existing DNS zone, create **only** an A record named `store` pointing to that VM's public IPv4 address. Add AAAA only if IPv6 is actually configured. Preserve the apex/`www` records serving the existing site. DNS-only mode initially simplifies connection troubleshooting.
4. In both the cloud firewall and OS firewall, allow inbound TCP 80 and 443. Restrict SSH to your own IP. Do not open database port 3306. Caddy handles HTTPS certificate issuance/renewal once public DNS and ports work. See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).
5. Copy **only** `deploy/woocommerce/` to a private directory on the VM. Create `.env` there from `.env.example`, fill in your email and two distinct random DB passwords, and use `chmod 600 .env`. Keep `LALILLY_ALLOW_PAID_ORDERS=false`.
6. From that directory, run `docker compose config --quiet` (do not print expanded secrets), then `docker compose up -d`. The image tags track maintained releases; record tested image digests before launch and retest upgrades. Never run `docker compose down -v` on a store with data.
7. Complete the WordPress installer at `https://store.lillypug.com/wp-admin/` with your own unique admin password. Do not paste admin passwords into chat or JavaScript. Install/activate the free WooCommerce plugin; decline paid extensions. The must-use La Lilly plugin is mounted automatically by Compose.
8. Set WordPress Address and Site Address to `https://store.lillypug.com` (also enforced by Compose). Set **Settings → Permalinks → Post name**. Set currency USD. Discourage search indexing; the plugin and proxy also send noindex. The catalog landing pages show a minimal backend notice, while API/admin/OAuth remain reachable. Do not use an entire-site login/password gate, maintenance plugin, or firewall challenge that blocks Tapstitch.
9. Leave Woo payment gateways disabled: Stripe is already charging the customer on the main site. Set up business/store details and shipping zones as appropriate for Tapstitch. Imported orders preserve the shipping actually charged by Stripe; Woo shipping rules do not quote Tapstitch supplier shipping costs.
10. Use separate Read/Write grants for the frontend bridge and Tapstitch. The approved setup uses one dedicated Shop Manager integration account: a website API key plus Tapstitch's separate official authorization grant. Do not share one key between integrations. Store secrets in Cloudflare encrypted settings and a root-only server backup, with no persistent plaintext copy on the PC. The modern REST API is built into WooCommerce; do not enable the legacy API. See [WooCommerce REST API setup](https://woocommerce.com/document/woocommerce-rest-api/).
11. Confirm `https://store.lillypug.com/wp-json/` returns JSON and the bridge credentials can GET `/wp-json/wc/v3/lalilly-bridge`. A 401 from an unauthenticated orders route is normal. Do not disable authentication to make that endpoint public.

Oracle has capacity shortages and may reclaim idle free VMs. Keep off-VM backups and a restore procedure; $0/month hosting is a target, not an uptime guarantee. The existing domain, card processing, tax services if enabled, garments, sewn labels and supplier shipping are separate costs. No paid service is enabled here.

## Outside the repo: connect Tapstitch and preserve variants/labels

1. In Tapstitch, link the WooCommerce store using exactly `https://store.lillypug.com`, then complete its official authorization flow. Follow the current [Tapstitch WooCommerce connection instructions](https://www.tapstitch.com/help-center/faq/detail/integrate-my-Woocommerce-store). Install a connector plugin only if the actual connection flow requests it. If a firewall blocks it, scope an exception to the required paths/source rather than removing all site protection.
2. Keep **Manual Submission** selected and disable automatic supplier payments while testing. Store order sync, submission to production, and payment to Tapstitch are separate steps. See [Tapstitch auto-submission documentation](https://www.tapstitch.com/help-center/faq/detail/How-to-set-up-Auto-Order-Submission).
3. Create the garment in Tapstitch and configure the **La Lilly sewn label on that exact product**. Confirm the garment supports the intended label and inspect the preview. The Woo bridge cannot add a sewn label by itself. Confirm availability, placement and any per-unit label fee in Tapstitch before selling that garment.
4. Publish/sync that product **from Tapstitch to WooCommerce**. Keep the resulting Woo parent IDs, variation IDs, SKUs and Tapstitch linkage metadata. Do not rebuild it manually in WooCommerce or replace existing Printify IDs with guessed Tapstitch IDs.
5. Use the read-only catalog inspection command below to collect real Woo IDs/SKUs/attributes. Match each customer-visible size and color explicitly. Existing storefront prices remain authoritative; review garment fit, mockups, material, pricing, supplier shipping and product descriptions before mapping any existing product to a different blank. If they differ, it should be a separately reviewed product launch.

## Cloudflare configuration and read-only verification

Set these in **Cloudflare Pages server environment/secrets**, never in `store.js`, HTML or public JavaScript. Preserve all existing Stripe/Printful/Printify secrets and the `ORDERS` binding.

| Variable | Initial value / purpose |
| --- | --- |
| `WOOCOMMERCE_ENABLED` | `false`; opt-in routing switch for new checkouts |
| `WOOCOMMERCE_URL` | `https://store.lillypug.com` |
| `WOOCOMMERCE_CONSUMER_KEY` / `WOOCOMMERCE_CONSUMER_SECRET` | Dedicated Read/Write credentials, stored as secrets |
| `WOOCOMMERCE_VARIANTS_JSON` | `{}` initially; exact mapping below |
| `WOOCOMMERCE_ALLOW_LIVE_CHECKOUT` | `false` until acceptance checks pass |
| `WOOCOMMERCE_ORDER_MODE` | `review` initially; `processing` only for reviewed production rollout |
| `WOOCOMMERCE_WEBHOOK_SECRET` | Independent random shared webhook secret |
| `WOOCOMMERCE_TRACKING_META_KEY` | Empty until actual Tapstitch tracking metadata is verified |

Example mapping shape — **these are fictional IDs/SKUs, not ready-to-use mappings**:

```json
{
  "6": [
    {
      "size": "M", "color": "White",
      "productId": 100, "variationId": 101, "sku": "TAP-WHITE-M",
      "attributes": [{"name":"Size","option":"M"},{"name":"Color","option":"White"}]
    }
  ]
}
```

Keys are existing storefront product IDs. Every selectable size/color of an opted-in product needs exactly one matching entry. A missing or duplicate combination blocks checkout instead of falling back to a different supplier. Storefront option labels must match the configured Woo attribute options exactly; aliases such as `XL` → `Extra Large` need an explicitly reviewed adapter. Use `variationId: 0, attributes: []` only for truly simple products with no choices. The adapter verifies parent/variation identity, SKU, attributes and availability over authenticated REST before opening Stripe Checkout. IDs and mapping are frozen in KV for the paid webhook; later flag/catalog edits do not reroute an already-started Woo checkout. The captured attributes are checked again when importing the paid order.

For isolated development, `.dev.vars` may contain separate test credentials only. The approved production setup keeps credentials in Cloudflare encrypted settings and a root-only VM backup; production credentials were not saved as plaintext on the PC. Run production catalog inspection on the VM using that backup, or an in-memory secret transport.

For an isolated development environment with test credentials:

```sh
npm ci --ignore-scripts
node --env-file=.dev.vars scripts/woocommerce-check.mjs --catalog
npm run check:woocommerce
npm test
```

These inspection commands read the catalog and bridge version; they do not place orders. Keep `.dev.vars` out of source control and outside any separately published static directory. Production never reads this local file. Use a **separate preview KV namespace, Stripe test keys and preferably a separate test Woo store**. Existing middleware redirects `*.pages.dev` to the live domain, so a Pages preview requires a dedicated staging hostname or an isolated staging-only middleware adjustment; do not mistake that redirect for a successful staging test.

## Tracking setup and limits

In WooCommerce → Settings → Advanced → Webhooks, create `Order updated` (optionally also `Order created`) deliveries to `https://lillypug.com/api/woocommerce-webhook`, REST API v3, using the exact `WOOCOMMERCE_WEBHOOK_SECRET`. Do not put the secret in the URL. Cron runs due events every minute even though the hidden store has little browser traffic. Watch webhook delivery logs and Woo scheduled actions; failed webhooks can become disabled.

Tapstitch's exact Woo tracking schema has not been verified on your store. Inspect a real connected shipment first. The current optional metadata adapter expects an object or array with `tracking_number`, `tracking_url` (HTTPS), `tracking_provider`, under the configured metadata key. If Tapstitch uses another shape or order notes, add an explicit adapter after observing the payload. Do not guess metadata names or expose all Woo order metadata to the browser.

The existing tracking API also returns a `shipments` array and `fulfillmentStatus`. Its existing page shows the first clickable shipment and can display a tracking-number summary. Woo `completed` alone is not proof of shipment: without observed tracking, the UI continues to show Processing. No automatic tracking, partial-shipment completion, delivery confirmation or customer email from Tapstitch is claimed until verified on the connected store. Polling rereads Woo on each customer lookup, so missed update webhooks can recover once tracking is available.

## Acceptance and rollout — no charges during this work

1. Run local tests and PHP lint. Validate Compose on a Docker-equipped host. Keep all production flags off and the current live branch unchanged.
2. Bring up the public HTTPS backend and connect Tapstitch. Push a product with the correct sewn label from Tapstitch; inspect every Woo variation and mapping.
3. In an isolated staging environment, use Stripe test mode and the `review` order mode. Complete a checkout with test customer information. Check Woo parent/variation/SKU, quantities, shipping vs billing, retail totals, discounts and tax against Stripe. Woo remains on hold, even for a completed test payment.
4. Redeliver the same Stripe event, including concurrent deliveries and a simulated lost HTTP response. Verify one Woo order, unchanged lines and no production submission. Temporarily make Woo unavailable, then restore it and redeliver; verify recovery. Never manually place a replacement supplier order until reconciliation proves the original import did not succeed.
5. Tapstitch's six active webhooks include the Woo Processing trigger. The approved live test imported a synthetic $0 order through the real JS adapter and HTTPS plugin route, verified ten variation IDs and duplicate-import recovery, then moved only that test order to Processing. It appeared in Tapstitch as On Hold, with all ten size/color combinations and ten clothing-label lines. Woo order **26** / Tapstitch order **1563916963716198400** were both cancelled without payment. Stripe inputs were fixtures, not a real Stripe checkout. Do not pay or reopen this cancelled test. Tapstitch also documents an [unpaid order sync test](https://www.tapstitch.com/help-center/faq/detail/How-to-Test-Dropshipping-Order-Sync).
6. Verify the expected label and variant in Tapstitch. Tracking return requires a later real shipment; it cannot be fully validated without an actual fulfilled order. This work does not purchase that sample or order.
7. Only after those checks, enable live checkout for the mapped products. To release automatically from the bridge, both `WOOCOMMERCE_ORDER_MODE=processing` in Cloudflare and `LALILLY_ALLOW_PAID_ORDERS=true` on the VM must be deliberately set. Restart WordPress/cron containers after changing server env. The mode is captured at checkout/import; retries do not turn old review orders into production orders.
8. Separately review and configure Tapstitch auto-submission and supplier auto-payment. Customer payment to Stripe does **not** pay Tapstitch. Full automatic production requires that supplier-side configuration; no code here silently enables it.

## Deliberate first-release boundaries

- Tapstitch and existing-provider products cannot share one checkout yet. Existing Printful+Printify mixed carts still follow their current path. Supporting mixed Woo/legacy carts requires reliable allocation of discounted line totals, tax and shipping, plus a durable per-provider retry ledger.
- Woo imports are USD, US/Canada, 20 cart lines maximum, with exclusive tax calculation. Existing storefront prices/shipping thresholds and Stripe promotion behavior remain unchanged. Totals must reconcile exactly or import fails safely for review.
- Woo orders are created **after** a verified settled Stripe event, including legitimate zero-value promotional checkouts marked `no_payment_required`. Abandoned carts and unpaid Stripe sessions do not become supplier orders. The bridge does not create Woo cart sessions or use a public credential-bearing cart endpoint.
- No Woo payment gateway is invoked; the original Stripe payment intent (or the checkout reference for zero-value orders) is recorded as an external transaction. Tax is copied as externally calculated Stripe tax (rate ID 0), not recalculated by Woo. Review imported tax reporting and any manual Woo recalculation before launch.
- Refunds, cancellations, address edits, returns and chargebacks do not automatically cancel or refund Tapstitch production. Handle those operationally in both systems. Woo status updates are informational and never initiate a Stripe refund.
- The legacy fulfillment path has no durable exactly-once ledger and acknowledges supplier failures with HTTP 200. This pre-existing behavior is retained to avoid a broad Printify migration; do not enable automatic retries for legacy events without fixing that separately.
- Stripe retries Woo imports on HTTP 503; monitor Stripe failed deliveries and Woo pending imports, then redeliver after resolving configuration/outage issues. Configure operational alerts yourself; this code does not send messages or add a paid monitor. Keep backups of the Woo DB/volumes and KV order/snapshot data, and test restoring them. The idempotency mapping is part of the Woo order data and must survive a restore.

## Rollback

Set `WOOCOMMERCE_ENABLED=false` to stop routing new checkouts to Woo. Existing mapped Stripe sessions still use their saved Woo snapshot and must finish on that path, so keep Woo credentials/backend/webhooks working while they settle. Do not reroute paid Woo orders into Printify or delete their Woo records. Existing Printify mappings/webhooks remain available. To stop production, also set Tapstitch submission to Manual and disable its auto-payment; changing the frontend flag cannot recall an order already accepted for manufacturing.

## Verification record

See the delivered verification report for exact checks and remaining launch steps. Local tests use fake keys and synthetic customers. The separately approved live sync test created and cancelled one real backend test record with fictional contact data; no Stripe payment, supplier payment, production submission or shipment occurred. Tapstitch remains Manual with no card linked, the server paid-order gate is false, and the frontend live checkout gate remains false.
