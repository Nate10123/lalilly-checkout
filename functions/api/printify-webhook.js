// Cloudflare Pages Function — Printify calls this when something happens
// to an order on their end. We only care about "order:shipment:created"
// (gives us a tracking number) but Printify will send other event types
// too (order:created, order:updated, order:sent-to-production,
// order:shipment:delivered), which we just ignore.
//
// SETUP REQUIRED (unlike Printful, Printify webhooks aren't a dashboard
// field — you register them via Printify's own API):
// 1. Create a Cloudflare KV namespace called ORDERS and bind it to this
//    Pages project (both Production and Preview) as "ORDERS" — skip this
//    if you already did it for Printful, it's shared.
// 2. Make up a random secret string and set it as PRINTIFY_WEBHOOK_SECRET
//    in your Cloudflare environment variables.
// 3. Register the webhook by calling Printify's API once (Postman, curl,
//    whatever) — this is NOT a dashboard step:
//      POST https://api.printify.com/v1/shops/{shop_id}/webhooks.json
//      Authorization: Bearer YOUR_PRINTIFY_TOKEN
//      Body: {
//        "topic": "order:shipment:created",
//        "url": "https://your-site.pages.dev/api/printify-webhook",
//        "secret": "THE_SAME_RANDOM_STRING_FROM_STEP_2"
//      }
//    Printify signs each request with this secret in the X-Pfy-Signature
//    header (HMAC-SHA256 hex digest of the raw body) — that's what we
//    verify below.
//
// GET/HEAD handlers below exist only in case Printify's own reachability
// check (when you first register the webhook) uses a method other than
// POST — Cloudflare Pages Functions reject any method with no exported
// handler before this file's code ever runs, so without these, that
// check could fail for a reason no amount of fixing onRequestPost would
// touch. They're harmless for real traffic: only onRequestPost, which
// requires a verified signature to act on anything, does real work.
export async function onRequestGet(context) {
  console.log('Printify webhook GET ping received — headers:', JSON.stringify([...context.request.headers.entries()]));
  return new Response('ok', { status: 200 });
}

export async function onRequestHead(context) {
  console.log('Printify webhook HEAD ping received — headers:', JSON.stringify([...context.request.headers.entries()]));
  return new Response(null, { status: 200 });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const bodyText = await request.text(); // raw body — needed for the signature check
  const signature = request.headers.get('x-pfy-signature');

  // TEMPORARY — for diagnosing the "Webhook validation failed" error at
  // registration time. Logs exactly what came in, signature valid or not,
  // so it shows up in Cloudflare's live function logs regardless of the
  // outcome below. Safe to remove once registration succeeds.
  console.log('Printify webhook POST received.');
  console.log('Headers:', JSON.stringify([...request.headers.entries()]));
  console.log('Body:', bodyText);
  console.log('Signature header present:', !!signature, '| value:', signature);

  const validSignature = await verifyPrintifySignature(bodyText, signature, env.PRINTIFY_WEBHOOK_SECRET);
  if (!validSignature) {
    // Respond 200 rather than rejecting outright. Printify's own
    // reachability check when you first register a webhook (POST
    // /webhooks.json) sends a test request to this URL and expects a
    // success response before it will finish creating the webhook — and
    // that check does not appear to include a valid X-Pfy-Signature,
    // unlike genuine event deliveries afterward. Returning 401 here made
    // that initial registration fail with "Webhook validation failed"
    // every time. Since we never act on the payload below unless the
    // signature verified, an unsigned or forged request still can't
    // trigger anything — this only affects what status code we reply
    // with, not what data we trust.
    console.error('Printify webhook signature missing or invalid — ignoring payload, replying 200.');
    return new Response('ok', { status: 200 });
  }

  if (!env.ORDERS) {
    console.error('ORDERS KV namespace not bound — cannot record tracking info.');
    return new Response('ok', { status: 200 });
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch (err) {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (payload.type !== 'order:shipment:created') {
    return new Response('ignored', { status: 200 });
  }

  try {
    // Printify's webhook body is a thin reference to the order rather than
    // the full order — the order id normally shows up at `resource.id`,
    // but we fall back to a couple of other shapes seen in the wild in
    // case Printify's exact payload differs from what's documented here.
    const orderId = String(
      (payload.resource && payload.resource.id) || payload.id || (payload.data && payload.data.id)
    );
    if (!orderId) {
      console.error('Printify webhook had no order id we could find:', bodyText);
      return new Response('ok', { status: 200 });
    }

    const existingRaw = await env.ORDERS.get(`pfyorder:${orderId}`);
    if (!existingRaw) {
      console.error('Received tracking for unknown Printify order:', orderId);
      return new Response('ok', { status: 200 }); // 200 so Printify doesn't retry forever
    }

    // The webhook body doesn't reliably include the tracking number itself,
    // so fetch the order straight from Printify's API to get it.
    const shipment = await fetchPrintifyShipment(env, orderId);

    const order = JSON.parse(existingRaw);
    order.status = 'shipped';
    order.trackingNumber = (shipment && shipment.number) || null;
    order.trackingUrl = (shipment && shipment.url) || null;
    order.carrier = (shipment && shipment.carrier) || null;
    order.shippedAt = new Date().toISOString();

    await env.ORDERS.put(`pfyorder:${orderId}`, JSON.stringify(order));

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Error processing Printify webhook:', err.message);
    return new Response('ok', { status: 200 });
  }
}

// HMAC-SHA256 of the raw body, hex-encoded, compared against the
// X-Pfy-Signature header — using Web Crypto since Cloudflare's runtime
// doesn't have Node's `crypto` module (same reasoning as the Stripe
// webhook using constructEventAsync instead of the sync version).
//
// Per Printify's own docs, the header value is prefixed "sha256=" before
// the hex digest (e.g. "sha256=abc123..."), not the bare hex alone — an
// earlier version of this function compared against the raw hex only,
// which meant every legitimately-signed request (including Printify's
// validation ping when first registering the webhook) was rejected.
async function verifyPrintifySignature(bodyText, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyText));
  const computedHex = [...new Uint8Array(signatureBytes)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const expected = `sha256=${computedHex}`;

  // Constant-time-ish comparison — fine at this length/throughput; not
  // worth pulling in a dedicated timing-safe-compare for a webhook this
  // low-volume.
  if (expected.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

// Printify's shipment webhook doesn't reliably carry the tracking details
// itself, so pull the order back from their API to read `shipments[0]`.
async function fetchPrintifyShipment(env, orderId) {
  try {
    const res = await fetch(
      `https://api.printify.com/v1/shops/${env.PRINTIFY_SHOP_ID}/orders/${orderId}.json`,
      { headers: {
          Authorization: `Bearer ${env.PRINTIFY_API_KEY}`,
          // Required by Printify on every request — see the matching
          // note in _shared/printify.js.
          'User-Agent': 'LA-LILLY-store (lalilly-checkout.pages.dev)',
      } }
    );
    if (!res.ok) {
      console.error('Could not fetch Printify order for tracking details:', orderId);
      return null;
    }
    const data = await res.json();
    return (data.shipments && data.shipments[0]) || null;
  } catch (err) {
    console.error('Error fetching Printify order for tracking:', err.message);
    return null;
  }
}
