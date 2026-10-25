// Server-only WooCommerce adapter. No consumer keys or order addresses reach the browser.
const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
export const wooJson = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: jsonHeaders });

export function wooOrigin(env) {
  const url = new URL(env.WOOCOMMERCE_URL || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('WOOCOMMERCE_URL must be an HTTPS origin, without a path or credentials.');
  }
  return url.origin;
}

export async function wooRequest(env, path, { method = 'GET', body } = {}) {
  if (!env.WOOCOMMERCE_CONSUMER_KEY || !env.WOOCOMMERCE_CONSUMER_SECRET) throw new Error('WooCommerce credentials are missing.');
  const response = await fetch(`${wooOrigin(env)}/wp-json/wc/v3/${path}`, {
    // Workers supports manual redirects. Never follow one with API credentials.
    method, redirect: 'manual', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Basic ${btoa(`${env.WOOCOMMERCE_CONSUMER_KEY}:${env.WOOCOMMERCE_CONSUMER_SECRET}`)}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  // Never log upstream response bodies: they may contain customer data or secrets.
  if (!response.ok) throw new Error(`WooCommerce request failed (${response.status}).`);
  return response.json();
}

export function wooSelection(env, item) {
  if (env.WOOCOMMERCE_ENABLED !== 'true') return null;
  let mappings;
  try { mappings = JSON.parse(env.WOOCOMMERCE_VARIANTS_JSON || '{}'); }
  catch { throw new Error('Invalid WooCommerce mapping configuration.'); }
  if (!mappings || Array.isArray(mappings) || typeof mappings !== 'object') throw new Error('Invalid WooCommerce mapping configuration.');
  if (!Object.hasOwn(mappings, String(item.id))) return null;
  const entries = mappings[item.id];
  if (!Array.isArray(entries)) throw new Error('Invalid WooCommerce mapping.');
  const matches = entries.filter(v => (v.size || '') === (item.size || '') && (v.color || '') === (item.color || ''));
  if (matches.length !== 1) throw new Error('This size/color is not available through Tapstitch yet.');
  const v = matches[0];
  if (!Number.isSafeInteger(v.productId) || v.productId < 1 || !Number.isSafeInteger(v.variationId) || v.variationId < 0 || !v.sku || !Array.isArray(v.attributes)) {
    throw new Error('Incomplete WooCommerce product/variation mapping.');
  }
  if ((item.size || item.color) && (!v.variationId || v.attributes.length < Number(!!item.size) + Number(!!item.color))) {
    throw new Error('WooCommerce variant attributes must be explicitly mapped.');
  }
  const attributeNames = v.attributes.map(a => typeof a.name === 'string' ? a.name.toLowerCase() : '');
  if (attributeNames.includes('') || new Set(attributeNames).size !== attributeNames.length ||
      [item.size, item.color].filter(Boolean).some(option => !v.attributes.some(a => a.option === option))) {
    throw new Error('WooCommerce attributes must match the selected size/color labels.');
  }
  return { productId: v.productId, variationId: v.variationId, sku: v.sku, attributes: v.attributes };
}

export async function verifyWooVariant(env, mapping, quantity) {
  const parent = await wooRequest(env, `products/${mapping.productId}`);
  if (parent.id !== mapping.productId || parent.status !== 'publish') throw new Error('WooCommerce product is unavailable.');
  const variant = mapping.variationId
    ? await wooRequest(env, `products/${mapping.productId}/variations/${mapping.variationId}`) : parent;
  if ((mapping.variationId && (parent.type !== 'variable' || variant.id !== mapping.variationId)) ||
      (!mapping.variationId && parent.type !== 'simple') || variant.sku !== mapping.sku ||
      variant.purchasable === false || variant.stock_status === 'outofstock' ||
      (variant.manage_stock && variant.backorders === 'no' && variant.stock_quantity < quantity)) {
    throw new Error('WooCommerce variant identity or availability changed.');
  }
  for (const expected of mapping.attributes) {
    if (!expected.name || !expected.option || !(variant.attributes || []).some(a =>
      a.name.toLowerCase() === expected.name.toLowerCase() && a.option === expected.option)) {
      throw new Error('WooCommerce size/color attributes do not match the configured variant.');
    }
  }
}

export async function prepareWooCheckout(env, cart, products, getPriceCents) {
  const selections = cart.map(item => wooSelection(env, item));
  if (cart.some((item, i) => products[item.id]?.provider === 'woocommerce' && !selections[i])) {
    throw new Error('This Tapstitch product is not available for checkout yet.');
  }
  if (!selections.some(Boolean)) return null;
  if (!selections.every(Boolean)) throw new Error('Please check out Tapstitch items separately from other items.');
  if (!env.ORDERS) throw new Error('WooCommerce requires the ORDERS storage binding.');
  if (cart.length > 20) throw new Error('Please use no more than 20 cart lines.');
  if (/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || '') && env.WOOCOMMERCE_ALLOW_LIVE_CHECKOUT !== 'true') {
    throw new Error('Tapstitch checkout is still in testing.');
  }
  const bridge = await wooRequest(env, 'lalilly-bridge');
  if (bridge.version !== 1) throw new Error('Install the La Lilly WooCommerce bridge plugin first.');
  const lines = cart.map((item, index) => ({ ...item, woo: selections[index], unitCents: getPriceCents(products[item.id], item.size, item.color) }));
  // Aggregate duplicates so splitting a cart line cannot bypass the stock check.
  const quantities = new Map();
  for (const line of lines) {
    const key = `${line.woo.productId}:${line.woo.variationId}`;
    quantities.set(key, (quantities.get(key) || 0) + line.qty);
  }
  for (const line of lines) await verifyWooVariant(env, line.woo, quantities.get(`${line.woo.productId}:${line.woo.variationId}`));
  return { version: 1, token: crypto.randomUUID(), releaseRequested: env.WOOCOMMERCE_ORDER_MODE === 'processing', lines };
}

const cents = value => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid Stripe monetary amount.');
  return value;
};

export function buildWooImport(session, snapshot, stripeLines) {
  const settled = session.payment_status === 'paid' || (session.payment_status === 'no_payment_required' && session.amount_total === 0);
  if (!settled || session.currency !== 'usd' || session.id !== snapshot.stripeSessionId) throw new Error('Stripe payment does not match this checkout.');
  if (stripeLines.has_more || stripeLines.data.length !== snapshot.lines.length) throw new Error('Incomplete Stripe line items.');
  const seen = new Set();
  const lines = stripeLines.data.map(line => {
    const key = line.price?.product?.metadata?.lalilly_line;
    if (!/^(0|[1-9]\d*)$/.test(key || '') || seen.has(key)) throw new Error('Stripe line identity is missing or duplicated.');
    seen.add(key);
    const saved = snapshot.lines[Number(key)];
    if (!saved || line.currency !== 'usd' || line.quantity !== saved.qty || cents(line.amount_subtotal) !== saved.qty * saved.unitCents || line.price?.tax_behavior !== 'exclusive') {
      throw new Error('Stripe line differs from the server checkout snapshot.');
    }
    const discount = cents(line.amount_discount);
    const tax = cents(line.amount_tax);
    if (discount > line.amount_subtotal || cents(line.amount_total) !== line.amount_subtotal - discount + tax) throw new Error('Stripe line totals do not balance.');
    return { ...saved.woo, quantity: saved.qty, subtotalCents: line.amount_subtotal, totalCents: line.amount_subtotal - discount, taxCents: tax };
  });
  const shipping = session.shipping_cost || { amount_subtotal: 0, amount_tax: 0, amount_total: 0 };
  if (cents(shipping.amount_total) !== cents(shipping.amount_subtotal) + cents(shipping.amount_tax)) throw new Error('Shipping totals do not balance.');
  const tax = lines.reduce((n, l) => n + l.taxCents, 0) + shipping.amount_tax;
  const subtotal = lines.reduce((n, l) => n + l.subtotalCents, 0);
  const discount = lines.reduce((n, l) => n + l.subtotalCents - l.totalCents, 0);
  if (subtotal !== cents(session.amount_subtotal) || tax !== cents(session.total_details.amount_tax) ||
      discount !== cents(session.total_details.amount_discount) ||
      subtotal - discount + tax + shipping.amount_subtotal !== cents(session.amount_total)) throw new Error('Stripe order totals do not balance.');
  const recipient = session.collected_information?.shipping_details || session.shipping_details;
  const address = recipient?.address;
  if (!address?.line1 || !address.city || !address.postal_code || !['US', 'CA'].includes(address.country) || !session.customer_details?.email) throw new Error('Missing supported customer shipping information.');
  const [first_name, ...last] = (recipient.name || session.customer_details.name || 'Customer').trim().split(/\s+/);
  const shippingAddress = { first_name, last_name: last.join(' '), address_1: address.line1, address_2: address.line2 || '', city: address.city, state: address.state || '', postcode: address.postal_code, country: address.country };
  return {
    external_id: session.id, test_mode: !session.livemode, transaction_id: session.payment_intent || session.id,
    currency: 'USD', lines, shipping: shippingAddress,
    billing: { ...shippingAddress, email: session.customer_details.email, phone: session.customer_details.phone || '' },
    // Billing address is not inferred from shipping: Stripe supplies the actual value.
    billing_address: session.customer_details.address,
    shippingCents: shipping.amount_subtotal, shippingTaxCents: shipping.amount_tax,
    discountCents: discount, taxCents: tax, totalCents: session.amount_total,
  };
}

export async function fulfillWooCheckout(env, session, stripe) {
  if (!env.ORDERS) throw new Error('ORDERS storage is required.');
  const raw = await env.ORDERS.get(`woo-checkout:${session.metadata.woo_snapshot}`);
  if (!raw) throw new Error('WooCommerce checkout snapshot is missing.');
  const snapshot = JSON.parse(raw);
  const stripeLines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ['data.price.product'] });
  const payload = buildWooImport(session, snapshot, stripeLines);
  payload.release = session.livemode === true && snapshot.releaseRequested === true;
  // The WP endpoint serializes imports by session ID and recovers the same order after a timeout.
  // KV alone is eventually consistent and must never be used as an exactly-once lock.
  const order = await wooRequest(env, 'lalilly-orders', { method: 'POST', body: payload });
  if (!Number.isSafeInteger(order.id) || order.id < 1) throw new Error('Invalid WooCommerce order response.');
  const previousRaw = await env.ORDERS.get(`wooorder:${order.id}`);
  const previous = previousRaw ? JSON.parse(previousRaw) : null;
  if (previous && previous.stripeSessionId !== session.id) throw new Error('Stored WooCommerce reference does not match this checkout.');
  await env.ORDERS.put(`wooorder:${order.id}`, JSON.stringify({ stripeSessionId: session.id, provider: 'woocommerce', providerOrderId: String(order.id), status: 'processing', createdAt: new Date().toISOString(), ...previous, wooStatus: order.status }));
  await env.ORDERS.put(`session:${session.id}`, JSON.stringify([{ provider: 'woocommerce', id: String(order.id) }]));
  return order;
}

export function wooTracking(order, env) {
  // Tapstitch's tracking metadata schema must be observed on the connected store.
  // An opt-in key can map an object (or array) with these field names; no guessing.
  const key = env.WOOCOMMERCE_TRACKING_META_KEY;
  const value = key && order.meta_data?.find(m => m.key === key)?.value;
  const entries = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  const shipments = entries.map(s => {
    let trackingUrl = null;
    try { const u = new URL(s.tracking_url); if (u.protocol === 'https:') trackingUrl = u.href; } catch {}
    return { trackingNumber: typeof s.tracking_number === 'string' ? s.tracking_number.slice(0, 150) : null, trackingUrl, carrier: typeof s.tracking_provider === 'string' ? s.tracking_provider.slice(0, 150) : null };
  }).filter(s => s.trackingNumber || s.trackingUrl);
  const terminal = ['cancelled', 'refunded', 'failed'].includes(order.status);
  return { wooStatus: order.status, status: terminal ? order.status : order.status === 'completed' && shipments.length ? 'shipped' : 'processing', shipments,
    trackingNumber: shipments[0]?.trackingNumber || null, trackingUrl: shipments[0]?.trackingUrl || null, carrier: shipments[0]?.carrier || null };
}

export async function refreshWooRecord(env, id, record) {
  const order = await wooRequest(env, `orders/${encodeURIComponent(id)}`);
  if (String(order.id) !== String(id) || !order.meta_data?.some(m => m.key === '_lalilly_stripe_session' && m.value === record.stripeSessionId)) throw new Error('WooCommerce order identity mismatch.');
  return { ...record, ...wooTracking(order, env) };
}
