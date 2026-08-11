// Stripe calls this URL automatically whenever a payment finishes.
// We verify the request really came from Stripe, then place the matching
// order with Printful so it prints and ships without you touching anything.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PRODUCTS } = require('./products');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let stripeEvent;
  try {
    const signature = event.headers['stripe-signature'];
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    // Not the event we care about — acknowledge and ignore.
    return { statusCode: 200, body: 'ignored' };
  }

  const session = stripeEvent.data.object;

  try {
    const cart = JSON.parse(session.metadata.cart || '[]');
    if (cart.length === 0) throw new Error('No cart metadata on session');

    const shipping = session.shipping_details || session.customer_details;
    const address = shipping && shipping.address;
    if (!address) throw new Error('No shipping address on session');

    const items = cart.map(({ id, qty }) => {
      const product = PRODUCTS[id];
      if (!product) throw new Error('Unknown product in order: ' + id);
      if (!product.printfulVariantId) {
        throw new Error(
          `Product "${product.name}" has no printfulVariantId set in products.js — ` +
          `fill this in from your Printful dashboard before going live.`
        );
      }
      return {
        sync_variant_id: product.printfulVariantId,
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
      // Set this to false while you're testing so orders sit as drafts
      // in Printful for you to review and confirm by hand first.
      confirm: true,
      external_id: session.id, // ties the Printful order back to this Stripe payment
    };

    const headers = {
      Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
    };
    // Only needed if your Printful API token spans multiple stores.
    if (process.env.PRINTFUL_STORE_ID) {
      headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;
    }

    const pfRes = await fetch('https://api.printful.com/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(printfulOrder),
    });

    const pfData = await pfRes.json();

    if (!pfRes.ok) {
      // Surface Printful's error in the function logs so you can see why
      // an order failed to place (bad address, missing variant, etc).
      console.error('Printful order failed:', JSON.stringify(pfData));
      return { statusCode: 500, body: JSON.stringify({ error: pfData }) };
    }

    console.log('Printful order created:', pfData.result && pfData.result.id);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('Fulfillment error:', err.message);
    // Return 200 so Stripe doesn't hammer-retry a permanently-broken order
    // (e.g. a missing variant ID) — but the error is in your function logs.
    return { statusCode: 200, body: JSON.stringify({ error: err.message }) };
  }
};
