// Cloudflare Pages Function — looks up an order's tracking status by the
// Stripe checkout session ID shown on the customer's confirmation page.
// Only returns the fields a customer actually needs; never returns their
// email/address back out, even though those live in the same KV record.
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
    const pfOrderId = await env.ORDERS.get(`session:${sessionId}`);
    if (!pfOrderId) {
      return new Response(JSON.stringify({ error: 'No order found for that reference.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const raw = await env.ORDERS.get(`pforder:${pfOrderId}`);
    if (!raw) {
      return new Response(JSON.stringify({ error: 'No order found for that reference.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const order = JSON.parse(raw);
    return new Response(JSON.stringify({
      status: order.status,
      trackingNumber: order.trackingNumber || null,
      trackingUrl: order.trackingUrl || null,
      carrier: order.carrier || null,
      createdAt: order.createdAt,
      shippedAt: order.shippedAt || null,
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
