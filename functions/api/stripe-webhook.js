// Cloudflare Pages Function — Stripe calls this the moment a payment
// succeeds. We verify it's really from Stripe, then place the matching
// order with Printful so it prints and ships automatically.

import Stripe from 'stripe';
import { PRODUCTS, getVariantId } from '../_shared/products.js';

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
    console.log('Fulfilling Printful order for Stripe session:', session.id);

    const cart = JSON.parse(session.metadata.cart || '[]');
    if (cart.length === 0) throw new Error('No cart metadata on session');

    const shipping = session.shipping_details || session.customer_details;
    const address = shipping && shipping.address;
    if (!address) throw new Error('No shipping address on session');

    const items = cart.map(({ id, qty, size }) => {
      const product = PRODUCTS[id];
      if (!product) throw new Error('Unknown product in order: ' + id);

      const variantId = getVariantId(product, size);
      if (!variantId) {
        throw new Error(
          `Product "${product.name}"${size ? ` (size ${size})` : ''} has no ` +
          `Printful variant ID set in products.js — fill this in before going live.`
        );
      }
      return {
        sync_variant_id: variantId,
        quantity: qty,
      };
    });

    const printfulOrder = {
      recipient: {
        name: shipping.name || session.customer_details.name,
        address1: address.line1,
        address2: address.line2 || '',
        city: address.city,
        state_code: address.state,
        country_code: address.country,
        zip: address.postal_code,
        email: session.customer_details.email,
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
      console.error('Printful order failed:', JSON.stringify(pfData));
      return new Response(JSON.stringify({ error: pfData }), { status: 500 });
    }

    console.log('Printful order created:', pfData.result && pfData.result.id);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('Fulfillment error:', err.message);
    // Return 200 so Stripe doesn't hammer-retry a permanently-broken order
    // — but the error is in your function logs.
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
}
