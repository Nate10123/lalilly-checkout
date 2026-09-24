// Cloudflare Pages Function — looks up an order's tracking status by the
// Stripe checkout session ID shown on the customer's confirmation page.
// Only returns the fields a customer actually needs; never returns their
// email/address back out, even though those live in the same KV record.
//
// A session can now be fulfilled by Printful, Printify, or both (a mixed
// cart), so `session:<id>` in KV holds a JSON array of {provider, id}
// refs written by stripe-webhook.js. Sessions created before Printify
// existed stored a bare Printful order id string instead — still handled
// below so old orders keep working.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing session_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.ORDERS) {
    return new Response(JSON.stringify({ error: 'Order lookup is not configured yet.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const sessionValue = await env.ORDERS.get(`session:${sessionId}`);
    if (!sessionValue) {
      return new Response(JSON.stringify({ error: 'No order found for that reference.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const refs = parseOrderRefs(sessionValue);

    const orders = [];
    for (const ref of refs) {
      const kvKey = ref.provider === 'printify' ? `pfyorder:${ref.id}` : `pforder:${ref.id}`;
      const raw = await env.ORDERS.get(kvKey);
      if (raw) orders.push(JSON.parse(raw));
    }

    if (orders.length === 0) {
      return new Response(JSON.stringify({ error: 'No order found for that reference.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Overall status is "shipped" only once every provider order for this
    // session has shipped — otherwise the customer sees "processing" until
    // all of it is on the way.
    const allShipped = orders.every((o) => o.status === 'shipped');

    // Most orders are single-provider, so this collapses back to the same
    // flat trackingNumber/trackingUrl/carrier shape the Track Your Order
    // page already expects. For the rare mixed-provider order, each field
    // joins multiple shipments with " | " rather than changing the page's
    // response shape.
    const join = (values) => {
      const present = values.filter(Boolean);
      return present.length > 0 ? present.join(' | ') : null;
    };

    return new Response(JSON.stringify({
      status: allShipped ? 'shipped' : 'processing',
      trackingNumber: join(orders.map((o) => o.trackingNumber)),
      trackingUrl: join(orders.map((o) => o.trackingUrl)),
      carrier: join(orders.map((o) => o.carrier)),
      createdAt: orders[0].createdAt,
      shippedAt: allShipped ? join(orders.map((o) => o.shippedAt)) : null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Order status lookup error:', err.message);
    return new Response(JSON.stringify({ error: 'Something went wrong looking up your order.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handles both the current format (a JSON array of {provider, id}, written
// by stripe-webhook.js since Printify was added) and the legacy format
// (a bare Printful order id string, from before Printify existed).
function parseOrderRefs(sessionValue) {
  try {
    const parsed = JSON.parse(sessionValue);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    // Not JSON — fall through to the legacy plain-string case below.
  }
  return [{ provider: 'printful', id: sessionValue }];
}
