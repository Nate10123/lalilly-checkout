// Cloudflare Pages Function — Stripe calls this the moment a payment
// succeeds. We verify it's really from Stripe, then place the matching
// order(s) with whichever provider(s) the cart's products belong to —
// Printful and/or Printify — so everything prints and ships automatically.
// A single cart can span both providers (e.g. an existing Printful shirt
// plus a new Printify mug); we place one order per provider that has items.

import Stripe from 'stripe';
import { PRODUCTS, getVariantId, getPriceCents, getProvider, getPrintifyProductId } from '../_shared/products.js';
import { placePrintifyOrder } from '../_shared/printify.js';

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

  if (stripeEvent.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = stripeEvent.data.object;

  try {
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
    const orderRefs = []; // [{ provider, id }] — saved against this session
    const errors = [];

    if (printfulItems.length > 0) {
      try {
        const pfOrderId = await placePrintfulOrder(env, { items: printfulItems, recipient });
        orderRefs.push({ provider: 'printful', id: pfOrderId });
      } catch (err) {
        console.error('Printful order failed:', err.message);
        errors.push(err.message);
      }
    }

    if (printifyItems.length > 0) {
      try {
        const pfyData = await placePrintifyOrder(env, {
          items: printifyItems,
          recipient,
          externalId: session.id,
        });
        orderRefs.push({ provider: 'printify', id: String(pfyData.id) });
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
        const orderRecord = {
          stripeSessionId: session.id,
          provider: ref.provider,
          providerOrderId: ref.id,
          email: session.customer_details.email,
          status: 'processing',
          items: cart,
          createdAt: new Date().toISOString(),
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
      // Return 200 so Stripe doesn't hammer-retry a permanently-broken
      // order — but the error is in your function logs, and any provider
      // that DID succeed above was still saved and will fulfill normally.
      return new Response(JSON.stringify({ error: errors.join('; ') }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('Fulfillment error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
}

// Places the Printful order and returns its order id. Kept in this file
// (rather than a _shared/printful.js module, unlike the newer Printify
// helper) since it was already inline here before Printify existed.
async function placePrintfulOrder(env, { items, recipient }) {
  const printfulOrder = {
    recipient: {
      name: recipient.name,
      address1: recipient.address1,
      address2: recipient.address2,
      city: recipient.city,
      state_code: recipient.state_code,
      country_code: recipient.country_code,
      zip: recipient.zip,
      email: recipient.email,
    },
    items,
    // confirm: true places the order for production immediately.
    // Set to false while testing so orders sit as drafts in Printful
    // for you to review before anything actually goes to print.
    confirm: false,
  };

  const headers = {
    Authorization: `Bearer ${env.PRINTFUL_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (env.PRINTFUL_STORE_ID) {
    headers['X-PF-Store-Id'] = env.PRINTFUL_STORE_ID;
  }

  const pfRes = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(printfulOrder),
  });

  const pfData = await pfRes.json();

  if (!pfRes.ok) {
    throw new Error('Printful order failed: ' + JSON.stringify(pfData));
  }

  console.log('Printful order created:', pfData.result && pfData.result.id);
  return String(pfData.result.id);
}
