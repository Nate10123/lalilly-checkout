// This function runs on Netlify's servers, never in the browser.
// Your Stripe secret key stays here and is never exposed to customers.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PRODUCTS } = require('./products');

// Matches the "Free shipping over $50" banner on the storefront.
const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
const STANDARD_SHIPPING_CENTS = 499;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { cart } = JSON.parse(event.body);

    if (!Array.isArray(cart) || cart.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty' }) };
    }

    // Normalize + validate quantities and sizes, using OUR price list,
    // never the browser's.
    const normalizedCart = cart.map((item) => {
      const product = PRODUCTS[item.id];
      if (!product) throw new Error('Unknown product: ' + item.id);
      const qty = Math.max(1, Math.min(50, parseInt(item.qty, 10) || 1));

      if (product.sizes) {
        if (!item.size || !product.sizes[item.size]) {
          throw new Error(`Please choose a size for "${product.name}".`);
        }
        return { id: item.id, qty, size: item.size };
      }
      return { id: item.id, qty };
    });

    const line_items = normalizedCart.map(({ id, qty, size }) => {
      const product = PRODUCTS[id];
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: size ? `${product.name} (${size})` : product.name,
          },
          unit_amount: product.priceCents,
        },
        quantity: qty,
      };
    });

    // Figure out shipping the same way the storefront advertises it.
    const subtotalCents = normalizedCart.reduce((sum, { id, qty }) => {
      return sum + PRODUCTS[id].priceCents * qty;
    }, 0);
    const qualifiesForFreeShipping = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;

    const shipping_options = [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: {
            amount: qualifiesForFreeShipping ? 0 : STANDARD_SHIPPING_CENTS,
            currency: 'usd',
          },
          display_name: qualifiesForFreeShipping ? 'Free shipping' : 'Standard shipping',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 5 },
            maximum: { unit: 'business_day', value: 10 },
          },
        },
      },
    ];

    const siteUrl = process.env.URL || 'http://localhost:8888';

    const sessionConfig = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      shipping_options,
      success_url: `${siteUrl}/success.html`,
      cancel_url: `${siteUrl}/`,
      // Stash exactly what was ordered (by our internal product IDs, plus
      // size where relevant) so the webhook can rebuild the order for
      // Printful without guessing from Stripe's line items.
      metadata: {
        cart: JSON.stringify(normalizedCart),
      },
    };

    // Real sales tax collection. This requires turning on Stripe Tax first
    // (Stripe Dashboard → Settings → Tax → Activate) — until you do, leave
    // ENABLE_STRIPE_TAX unset/false so checkout keeps working without it.
    if (process.env.ENABLE_STRIPE_TAX === 'true') {
      sessionConfig.automatic_tax = { enabled: true };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
