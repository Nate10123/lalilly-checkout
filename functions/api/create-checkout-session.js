// Cloudflare Pages Function — runs on Cloudflare's edge, never in the browser.
// Your Stripe secret key stays here and is never exposed to customers.
//
// Cloudflare's runtime is NOT Node.js — it's the same engine that powers
// Workers. That means: no process.env (use context.env instead), and
// requests/responses use the standard Web Fetch API, not Node's http module.

import Stripe from 'stripe';
import { PRODUCTS } from '../_shared/products.js';

// Matches the "Free shipping over $50" banner on the storefront.
const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
const STANDARD_SHIPPING_CENTS = 499;

export async function onRequestPost(context) {
  const { request, env } = context;

  // Stripe's SDK defaults to a Node-only HTTP client. On Cloudflare's edge
  // runtime we have to explicitly tell it to use fetch() instead.
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const { cart } = await request.json();

    if (!Array.isArray(cart) || cart.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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

    // Derive the site's own URL from the incoming request instead of an
    // env var — works automatically on any domain you point at this.
    const siteUrl = new URL(request.url).origin;

    const sessionConfig = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      shipping_options,
      success_url: `${siteUrl}/success.html`,
      cancel_url: `${siteUrl}/`,
      metadata: {
        cart: JSON.stringify(normalizedCart),
      },
    };

    // Real sales tax collection. Requires activating Stripe Tax first
    // (Stripe Dashboard → Settings → Tax → Activate).
    if (env.ENABLE_STRIPE_TAX === 'true') {
      sessionConfig.automatic_tax = { enabled: true };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
