// Cloudflare Pages Function — Printful calls this when something happens
// to an order on their end. We only care about "package_shipped" (gives
// us the tracking number) but Printful will send other event types too,
// which we just ignore.
//
// SETUP REQUIRED (see the setup guide for full steps):
// 1. Create a Cloudflare KV namespace called ORDERS and bind it to this
//    Pages project (both Production and Preview) as "ORDERS".
// 2. Set a PRINTFUL_WEBHOOK_SECRET environment variable to a random string
//    you make up — this is NOT a Printful-provided secret, it's a shared
//    password you choose so randoms on the internet can't POST fake
//    "shipped" events to this endpoint.
// 3. In Printful → Settings → Stores → your store → Webhooks, add:
//      URL: https://your-site.pages.dev/api/printful-webhook?secret=YOUR_SECRET
//      Event: package_shipped
export async function onRequestPost(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const providedSecret = url.searchParams.get('secret');
  if (!env.PRINTFUL_WEBHOOK_SECRET || providedSecret !== env.PRINTFUL_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!env.ORDERS) {
    console.error('ORDERS KV namespace not bound — cannot record tracking info.');
    return new Response('ok', { status: 200 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Printful sends many event types (order_created, order_updated,
  // package_shipped, package_returned, etc.) — we only act on shipping.
  if (payload.type !== 'package_shipped') {
    return new Response('ignored', { status: 200 });
  }

  try {
    const pfOrderId = String(payload.data.order.id);
    const shipment = payload.data.shipment || {};

    const existingRaw = await env.ORDERS.get(`pforder:${pfOrderId}`);
    if (!existingRaw) {
      console.error('Received tracking for unknown order:', pfOrderId);
      return new Response('ok', { status: 200 }); // 200 so Printful doesn't retry forever
    }

    const order = JSON.parse(existingRaw);
    order.status = 'shipped';
    order.trackingNumber = shipment.tracking_number || null;
    order.trackingUrl = shipment.tracking_url || null;
    order.carrier = shipment.carrier || null;
    order.shippedAt = new Date().toISOString();

    await env.ORDERS.put(`pforder:${pfOrderId}`, JSON.stringify(order));

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Error processing Printful webhook:', err.message);
    return new Response('ok', { status: 200 });
  }
}
