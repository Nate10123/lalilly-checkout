// This function runs on Netlify's servers, never in the browser.
// Your Stripe secret key stays here and is never exposed to customers.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PRODUCTS } = require('./products');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { cart } = JSON.parse(event.body);

    if (!Array.isArray(cart) || cart.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty' }) };
    }

    // Normalize + validate quantities, using OUR price list, never the browser's.
    const normalizedCart = cart.map((item) => {
      const product = PRODUCTS[item.id];
      if (!product) throw new Error('Unknown product: ' + item.id);
      const qty = Math.max(1, Math.min(50, parseInt(item.qty, 10) || 1));
      return { id: item.id, qty };
    });

    const line_items = normalizedCart.map(({ id, qty }) => {
      const product = PRODUCTS[id];
      return {
        price_data: {
          currency: 'usd',
          product_data: { name: product.name },
          unit_amount: product.priceCents,
        },
        quantity: qty,
      };
    });

    const siteUrl = process.env.URL || 'http://localhost:8888';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      success_url: `${siteUrl}/success.html`,
      cancel_url: `${siteUrl}/`,
      // Stash exactly what was ordered (by our internal product IDs) so the
      // webhook can rebuild the order for Printful without guessing from
      // Stripe's line items.
      metadata: {
        cart: JSON.stringify(normalizedCart),
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
