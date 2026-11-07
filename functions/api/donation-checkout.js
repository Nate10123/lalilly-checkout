import Stripe from 'stripe';

const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });

export async function onRequestPost({ request, env }) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('Origin') !== origin) return reply({ error: 'Please donate from the La Lilly website.' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply({ error: 'Invalid request.' }, 400);
  if (!env.STRIPE_SECRET_KEY) return reply({ error: 'Donations are temporarily unavailable.' }, 503);
  try {
    const reader = request.body?.getReader();
    let bytes = 0, text = '';
    const decoder = new TextDecoder();
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024) { await reader.cancel(); return reply({ error: 'Invalid request.' }, 400); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const { amount, requestId } = JSON.parse(text);
    if (typeof amount !== 'string' || !/^\d{1,3}(?:\.\d{1,2})?$/.test(amount) || typeof requestId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestId)) return reply({ error: 'Choose an amount between $1 and $500 USD.' }, 400);
    const [dollars, fraction = ''] = amount.split('.');
    const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
    if (cents < 100 || cents > 50000) return reply({ error: 'Choose an amount between $1 and $500 USD.' }, 400);
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', payment_method_types: ['card'], submit_type: 'donate',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name: 'Support La Lilly', description: 'One-time contribution to La Lilly. No product or shipment included.' } } }],
      metadata: { purpose: 'lalilly_donation', fulfillment: 'none' },
      payment_intent_data: { metadata: { purpose: 'lalilly_donation' } },
      success_url: origin + '/donations?thanks=1', cancel_url: origin + '/donations?canceled=1',
    }, { idempotencyKey: 'lalilly-donation-' + requestId });
    return reply({ url: session.url });
  } catch {
    return reply({ error: 'We couldn’t open donation checkout. Please try again.' }, 400);
  }
}
