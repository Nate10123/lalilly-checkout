// Cloudflare Pages Function — Stripe calls this the moment a payment
// succeeds. We verify it's really from Stripe, then place the matching
// order(s) with whichever provider(s) the cart's products belong to —
// Printful and/or Printify — so everything prints and ships automatically.
// A single cart can span both providers (e.g. an existing Printful shirt
// plus a new Printify mug); we place one order per provider that has items.

import Stripe from 'stripe';
import { PRODUCTS, getVariantId, getPriceCents, getProvider, getPrintifyProductId } from '../_shared/products.js';
import { EXTRA_PRODUCTS } from '../_shared/extra-products.js';
import { placePrintifyOrder } from '../_shared/printify.js';
import { fulfillPrintfulOrder, printfulAutoAllowed } from '../_shared/printful.js';
import { fulfillWooCheckout, wooJson } from '../_shared/woocommerce.js';

Object.assign(PRODUCTS, EXTRA_PRODUCTS);

export async function onRequestPost(context) {
  const { request, env } = context;

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = request.headers.get('stripe-signature');
  const body = await request.text(); // raw body, needed for signature check

  let stripeEvent;
  try {
    // constructEventAsync (not the sync constructEvent) — the sync version
    // relies on Node's crypto module, which doesn't exist in Cloudflare's
    // runtime. The async version uses Web Crypto instead, which does.
    stripeEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(stripeEvent.type)) {
    return new Response('ignored', { status: 200 });
  }

  const session = stripeEvent.data.object;

  // Contributions are recorded by Stripe and never enter merchandise fulfillment.
  if (session.metadata?.purpose === 'lalilly_donation') {
    return new Response('donation-received', { status: 200 });
  }

  if (session.payment_status !== 'paid' && !(session.payment_status === 'no_payment_required' && session.amount_total === 0)) return new Response('unpaid', { status: 200 });

  if (session.metadata?.fulfillment === 'woocommerce') {
    try {
      const order = await fulfillWooCheckout(env, session, stripe);
      return wooJson({ ok: true, orderId: order.id });
    } catch {
      // Retry only the isolated WooCommerce flow. The plugin prevents duplicate orders.
      console.error('WooCommerce import failed; Stripe should retry. Session:', session.id);
      return wooJson({ error: 'WooCommerce import is pending. Retry required.' }, 503);
    }
  }

  // Stripe test payments must not create real supplier orders by default.
  // A separate, explicitly approved draft-only test requires this opt-in and
  // Manual approval in Printify; its API has no general sandbox guarantee.
  if (session.livemode !== true && env.LEGACY_ALLOW_TEST_ORDERS !== 'true') {
    return new Response('test-payment-ignored', { status: 200 });
  }

  try {
    if (!env.ORDERS) throw new Error('Order tracking storage is required for fulfillment.');
    console.log('Fulfilling order for Stripe session:', session.id);

    const cart = JSON.parse(session.metadata.cart || '[]');
    if (cart.length === 0) throw new Error('No cart metadata on session');

    const shipping = session.shipping_details || session.customer_details;
    const address = shipping && shipping.address;
    if (!address) throw new Error('No shipping address on session');

    const recipient = {
      name: shipping.name || session.customer_details.name,
      address1: address.line1,
      address2: address.line2 || '',
      city: address.city,
      state_code: address.state,
      country_code: address.country,
      zip: address.postal_code,
      email: session.customer_details.email,
    };

    // Resolve every cart line up front (and validate it) before calling
    // either provider's API, then split by provider. Validation failures
    // here abort the whole thing, same as before Printify was added — a
    // cart referencing a product with no variant ID configured shouldn't
    // result in a half-placed order.
    const printfulItems = [];
    const printifyItems = [];

    for (const { id, qty, size, color } of cart) {
      const product = PRODUCTS[id];
      if (!product) throw new Error('Unknown product in order: ' + id);
      if (getProvider(product) === 'woocommerce') {
        throw new Error('Tapstitch orders require a verified WooCommerce checkout snapshot.');
      }

      const variantId = getVariantId(product, size, color);
      if (!variantId) {
        const variantLabel = [color, size ? `size ${size}` : null].filter(Boolean).join(', ');
        throw new Error(
          `Product "${product.name}"${variantLabel ? ` (${variantLabel})` : ''} has no ` +
          `variant ID set in products.js — fill this in before going live.`
        );
      }

      const provider = getProvider(product);

      if (provider === 'printify') {
        const printifyProductId = getPrintifyProductId(product);
        if (!printifyProductId) {
          throw new Error(`Product "${product.name}" is missing printifyProductId in products.js.`);
        }
        printifyItems.push({ printifyProductId, variantId, quantity: qty });
      } else {
        // Declare our own charged price on the order line — otherwise
        // Printful falls back to the retail_price stored on the sync
        // variant, which can drift out of sync with what we actually
        // charge (see products.js / store.js for the source of truth).
        const priceCents = getPriceCents(product, size, color);
        const orderItem = { sync_variant_id: variantId, quantity: qty };
        if (priceCents != null) {
          orderItem.retail_price = (priceCents / 100).toFixed(2);
        }
        printfulItems.push(orderItem);
      }
    }

    // Place each provider's order independently — if one provider's API
    // call fails, we still want the other provider's items fulfilled and
    // tracked rather than losing both.
    const previousRefs = env.ORDERS ? await env.ORDERS.get(`session:${session.id}`) : null;
    let orderRefs = []; // [{ provider, id }] — saved against this session
    if (previousRefs) {
      try { const parsed = JSON.parse(previousRefs); orderRefs = Array.isArray(parsed) ? parsed : [{ provider: 'printful', id: previousRefs }]; }
      catch { orderRefs = [{ provider: 'printful', id: previousRefs }]; }
    }
    const errors = [];

    if (printfulItems.length > 0 && !orderRefs.some(ref => ref.provider === 'printful')) {
      try {
        const result = await fulfillPrintfulOrder(env, {
          items: printfulItems, recipient, stripeSessionId: session.id,
          autoConfirm: printfulAutoAllowed(env, session),
        });
        orderRefs.push({ provider: 'printful', id: result.id, supplierStatus: result.status });
        if (env.ORDERS) await env.ORDERS.put(`session:${session.id}`, JSON.stringify(orderRefs));
      } catch (err) {
        console.error('Printful order failed:', err.message);
        errors.push(err.message);
      }
    }

    if (printifyItems.length > 0 && !orderRefs.some(ref => ref.provider === 'printify')) {
      try {
        const pfyData = await placePrintifyOrder(env, {
          items: printifyItems,
          recipient,
          externalId: session.id,
        });
        orderRefs.push({ provider: 'printify', id: String(pfyData.id) });
        if (env.ORDERS) await env.ORDERS.put(`session:${session.id}`, JSON.stringify(orderRefs));
      } catch (err) {
        console.error('Printify order failed:', err.message);
        errors.push(err.message);
      }
    }

    // Save each order so the customer can look up its status/tracking later
    // on the Track Your Order page, and so each provider's shipping webhook
    // has somewhere to write the tracking number once it comes in. ORDERS
    // is a KV namespace — see wrangler.toml.
    if (env.ORDERS && orderRefs.length > 0) {
      for (const ref of orderRefs) {
        const kvKey = ref.provider === 'printify' ? `pfyorder:${ref.id}` : `pforder:${ref.id}`;
        const previousRecord = await env.ORDERS.get(kvKey);
        const orderRecord = {
          stripeSessionId: session.id,
          provider: ref.provider,
          providerOrderId: ref.id,
          email: session.customer_details.email,
          status: 'processing',
          items: cart,
          createdAt: new Date().toISOString(),
          ...(ref.supplierStatus ? { supplierStatus: ref.supplierStatus } : {}),
          ...(previousRecord ? JSON.parse(previousRecord) : {}),
        };
        await env.ORDERS.put(kvKey, JSON.stringify(orderRecord));
      }
      // Stored as a JSON array so order-status.js can look up whichever
      // provider(s) fulfilled this session, even a mixed Printful+Printify
      // cart. order-status.js also understands the older plain-string
      // format from before Printify existed, so past orders keep working.
      await env.ORDERS.put(`session:${session.id}`, JSON.stringify(orderRefs));
    } else if (!env.ORDERS) {
      console.error('ORDERS KV namespace not bound — order tracking will not work for this order.');
    }

    if (errors.length > 0) {
      // Printful retries are protected by its unique external ID. Existing
      // Printify creation errors still require review: automatic retry of an
      // ambiguous create needs stronger supplier-side duplicate guarantees.
      const safeToRetry = printifyItems.length === 0 || orderRefs.some(ref => ref.provider === 'printify');
      return new Response(JSON.stringify({ error: 'Supplier fulfillment requires attention.' }), { status: safeToRetry ? 503 : 200 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('Fulfillment error:', err.message);
    return new Response(JSON.stringify({ error: 'Fulfillment requires attention.' }), { status: 503 });
  }
}
