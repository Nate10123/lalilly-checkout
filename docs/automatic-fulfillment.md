# Automatic fulfillment — October 31, 2026

Scope: Printful and Printify. The owner deferred Tapstitch; its checkout and paid
production gates remain disabled, and product 31 stays Coming Soon.

The owner explicitly approved Printful automatic production and supplier charges
on October 31. `PRINTFUL_AUTO_FULFILL=true` was saved as an encrypted Cloudflare
production setting and deployed in d2ac34d0-ad03-40e0-a2a3-0e9f5e97f51b. A new live
Stripe checkout for the hat passed without payment or supplier-order creation.
Printify retains 24-hour automatic approval but still needs the owner's payment
method confirmation; no card has been added by the agent.

## Printful

`PRINTFUL_AUTO_FULFILL=true` is the server-only production activation switch.
It defaults off when absent. Do not activate before the owner approves future
supplier charges. Keep the existing Stripe and Printful secrets unchanged.

The checkout handler preflights selected Printful sync variants through the
official API before creating a Stripe session. Unsynced, ignored, missing and
out-of-stock variants fail before payment. The server adds a new `v1` intent
marker only when this flag is enabled and the Stripe key is live.

The signed webhook confirms production only when the flag remains enabled,
Stripe reports a live paid session with a positive total, and the server-created
intent marker is present. Existing drafts and older checkouts lack that marker
and cannot be released by enabling the feature. Stripe test payments are ignored
by the legacy supplier flow unless `LEGACY_ALLOW_TEST_ORDERS=true` is explicitly
set for a separately authorized test. Printify must also be Manual for such a test.

Orders use a stable 32-character external ID derived from the Stripe session.
Printful documents uniqueness within a store. Existing orders are looked up before
creation; an ambiguous create or confirmation response recovers the same order.
Already submitted/canceled orders are not re-created. Draft confirmation failures
return 503 so Stripe retries. This does not override supplier payment failures,
inventory changes, design-review holds or other supplier exceptions.

## Printify

La Lilly API store 4482195 was inspected in the signed-in dashboard: ordinary
order approval is **Automatically (24 hours)**. No setting change is necessary
to keep that automation. The owner must add a payment method or maintain sufficient
balance; the account showed no card and USD 0.00 at inspection.

API-created orders follow that shop's approval setting. They do **not** necessarily
stay drafts just because our code omits send_to_production. No immediate-production
API call is added here, and order routing/personalization/delayed-order settings
are preserved. The existing stable external ID remains the Stripe session ID.

Successful provider references are saved as each provider completes. Sequential
Stripe replays reuse those references and preserve shipment/tracking records.
Cloudflare KV is eventually consistent and is not an atomic lock. This change
does not claim full concurrent idempotency for Printify. Ambiguous Printify create
failures remain a manual reconciliation case instead of being blindly retried;
no new supplier order should be created to resolve one until its external ID is
checked in Printify. Thus supplier exceptions still require owner attention.

Printify checkout now fetches the actual mapped products/variants before creating
a Stripe session. Disabled, missing or out-of-stock variants return 409 and do not
take payment. The Pugg Stone Wash Heavy Tee currently has S and 3XL out of stock;
S was already absent from the website, while the new check blocks 3XL dynamically.

## Account checks and acceptance

- Printful's La Lilly's Store (18595319) contains the matching 24-product catalog.
  A current account billing method is assigned to the stores. Active storefront
  tokens have Orders and Sync products/read scopes; no token was created, revealed,
  rotated or expanded during this work.
- Printful shows one product with at least one out-of-stock variant. The preflight
  checks each selected variant before payment; inventory can still change later.
- Woo bridge health and all seven webhooks are active, with paid orders disabled.
- Local tests exercise signed events, server-created intent, review/test exclusion,
  uniqueness/concurrent Printful creation, lost responses, retry failures, variant
  readiness and sequential Printify replays. No external order was created in tests.
- Printful production was activated with explicit owner approval. A real paid
  fulfillment has not been performed. A real charge, physical print/label inspection and shipment
  cannot be claimed as tested by mocked supplier requests.

The live hat checkout preflight verified the encrypted Cloudflare Printful
credential without paying for the Stripe session. Do not submit a test purchase
or old draft. The Classic Rainbow tie-dye M/L/XL/2XL variants are also currently
out of stock; Printful's selected-variant preflight blocks unavailable selections.

Printful charges the saved billing method for production, supplier shipping and
applicable supplier taxes. Printify does the same when its approval timer submits
an order. Stripe customer funds are separate; they are not automatically transferred
to either supplier. No monthly plan or paid platform upgrade is needed for this flow.

Sources: [Printful Orders API](https://developers.printful.com/docs/#tag/Orders-API),
[Printify Orders API](https://developers.printify.com/#orders),
[Printify billing](https://help.printify.com/hc/en-us/articles/4483630446865-When-will-I-be-charged-for-my-Printify-order).
