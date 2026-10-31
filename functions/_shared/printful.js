// Printful's unique external_id prevents a repeated Stripe delivery from
// creating another order. The API allows at most 32 characters for this ID.
export async function printfulExternalId(stripeSessionId) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stripeSessionId)));
  return 'll_' + Array.from(hash, b => b.toString(16).padStart(2, '0')).join('').slice(0, 29);
}

export function printfulAutoRequested(env) {
  return env.PRINTFUL_AUTO_FULFILL === 'true' && /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || '');
}

export function printfulAutoAllowed(env, session) {
  // New server-created checkout metadata is required. Enabling this flag
  // cannot release old drafts, old payments, or Stripe test checkouts.
  return printfulAutoRequested(env) && session.livemode === true &&
    session.payment_status === 'paid' && session.amount_total > 0 &&
    session.metadata?.printful_auto_fulfill === 'v1';
}

function headers(env) {
  if (!env.PRINTFUL_API_KEY) throw new Error('Printful is not configured.');
  return {
    Authorization: `Bearer ${env.PRINTFUL_API_KEY}`,
    'Content-Type': 'application/json',
    ...(env.PRINTFUL_STORE_ID ? { 'X-PF-Store-Id': env.PRINTFUL_STORE_ID } : {}),
  };
}

async function request(env, path, options = {}) {
  const response = await fetch(`https://api.printful.com${path}`, {
    ...options, headers: headers(env), redirect: 'manual',
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  return { response, order: data.result };
}

function validOrder(order) {
  return order && Number.isSafeInteger(Number(order.id)) && Number(order.id) > 0;
}

async function findOrder(env, externalId) {
  const { response, order } = await request(env, `/orders/@${externalId}`);
  if (response.status === 404) return null;
  if (!response.ok || !validOrder(order)) throw new Error('Printful order lookup failed.');
  return order;
}

export async function verifyPrintfulVariants(env, variantIds) {
  const ids = [...new Set(variantIds.map(String))];
  if (ids.length > 50) throw new Error('Please use a smaller cart.');
  for (const id of ids) {
    if (!/^\d+$/.test(id)) throw new Error('A Printful product is not configured.');
    const { response, order: result } = await request(env, `/store/variants/${id}`);
    const variant = result;
    if (!response.ok || String(variant?.id) !== id || variant.synced !== true || !variant.variant_id ||
        variant.is_ignored === true || variant.availability_status !== 'active') {
      throw new Error('A product is not currently ready for fulfillment. Please try again later.');
    }
  }
}

export async function fulfillPrintfulOrder(env, { items, recipient, stripeSessionId, autoConfirm = false }) {
  const externalId = await printfulExternalId(stripeSessionId);
  let order = await findOrder(env, externalId);
  if (!order) {
    try {
      const result = await request(env, '/orders', {
        method: 'POST', body: JSON.stringify({ external_id: externalId, recipient, items, confirm: false }),
      });
      if (!result.response.ok || !validOrder(result.order)) throw new Error('Printful order creation failed.');
      order = result.order;
    } catch (error) {
      // Includes a concurrent create (external ID in use) and a response lost
      // after Printful saved the order. Recover that order, never a new ID.
      order = await findOrder(env, externalId);
      if (!order) throw error;
    }
  }
  if (autoConfirm && order.status === 'draft') {
    try {
      const result = await request(env, `/orders/${order.id}/confirm`, { method: 'POST' });
      if (!result.response.ok || !validOrder(result.order)) throw new Error('Printful production confirmation failed.');
      order = result.order;
    } catch (error) {
      // A confirmation timeout or simultaneous webhook must not create a
      // second order or re-confirm an order already accepted by Printful.
      const recovered = await findOrder(env, externalId);
      if (!recovered || ['draft', 'failed', 'canceled'].includes(recovered.status)) throw error;
      order = recovered;
    }
    if (['draft', 'failed', 'canceled'].includes(order.status)) {
      throw new Error('Printful has not accepted this order for production.');
    }
  }
  return { id: String(order.id), status: order.status || 'draft', externalId };
}
