import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { wooOrigin, wooRequest, wooSelection, verifyWooVariant, prepareWooCheckout, buildWooImport, fulfillWooCheckout, wooTracking } from '../functions/_shared/woocommerce.js';
import { onRequestPost as checkout } from '../functions/api/create-checkout-session.js';
import { onRequestPost as stripeWebhook } from '../functions/api/stripe-webhook.js';
import { onRequestPost as wooWebhook, verifyWooSignature } from '../functions/api/woocommerce-webhook.js';
import { onRequestGet as orderStatus } from '../functions/api/order-status.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import { PRODUCTS, getProvider, getPriceCents } from '../functions/_shared/products.js';
import selectedMappings from '../docs/woocommerce-variants.json' with { type: 'json' };

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const json = data => Response.json(data);
function kv() { const values = new Map(); return { values, get: async k => values.get(k) || null, put: async (k, v) => { values.set(k, v); } }; }
const mapping = { productId: 100, variationId: 101, sku: 'TAP-WHITE-M', attributes: [{ name: 'Size', option: 'M' }, { name: 'Color', option: 'White' }] };
const item = { id: 6, size: 'M', color: 'White', qty: 2 };
const env = () => ({ WOOCOMMERCE_ENABLED: 'true', WOOCOMMERCE_URL: 'https://store.example.com', WOOCOMMERCE_CONSUMER_KEY: 'ck_test', WOOCOMMERCE_CONSUMER_SECRET: 'cs_test', WOOCOMMERCE_VARIANTS_JSON: JSON.stringify({ 6: [{ ...mapping, size: 'M', color: 'White' }] }), STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_test', WOOCOMMERCE_WEBHOOK_SECRET: 'test-secret', ORDERS: kv() });
const parent = { id: 100, status: 'publish', type: 'variable' };
const variant = { id: 101, sku: mapping.sku, attributes: mapping.attributes, stock_status: 'instock', purchasable: true };
function mockCatalog(fallback) {
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/lalilly-bridge')) return json({ version: 1 });
    if (path.endsWith('/products/100')) return json(parent);
    if (path.endsWith('/products/100/variations/101')) return json(variant);
    if (fallback) return fallback(url, options);
    throw new Error(`Unexpected URL: ${url}`);
  };
}
const snapshot = () => ({ stripeSessionId: 'cs_test_abcdefgh1234', lines: [{ ...item, woo: mapping, unitCents: 2750 }] });
const session = () => ({ id: 'cs_test_abcdefgh1234', payment_status: 'paid', currency: 'usd', livemode: false, payment_intent: 'pi_test_123', amount_subtotal: 5500, amount_total: 5549,
  total_details: { amount_tax: 550, amount_discount: 1000 }, shipping_cost: { amount_subtotal: 499, amount_tax: 0, amount_total: 499 },
  shipping_details: { name: 'Jane Smith', address: { line1: '1 Test St', city: 'Portland', state: 'OR', postal_code: '97201', country: 'US' } }, customer_details: { email: 'buyer@example.com', name: 'Jane Smith', address: { line1: '2 Billing St', city: 'Portland', state: 'OR', postal_code: '97201', country: 'US' } }, metadata: { fulfillment: 'woocommerce', woo_snapshot: 'snapshot-token' } });
const stripeLines = () => ({ has_more: false, data: [{ quantity: 2, currency: 'usd', amount_subtotal: 5500, amount_discount: 1000, amount_tax: 550, amount_total: 5050, price: { tax_behavior: 'exclusive', product: { metadata: { lalilly_line: '0' } } } }] });

test('WooCommerce requires HTTPS origin, never credential-bearing URLs', () => {
  assert.equal(wooOrigin(env()), 'https://store.example.com');
  for (const url of ['http://store.example.com', 'https://key:secret@store.example.com', 'https://store.example.com/shop', 'https://store.example.com/?key=secret']) assert.throws(() => wooOrigin({ WOOCOMMERCE_URL: url }));
});
test('disabled bridge preserves legacy providers and all Printify product IDs', () => {
  assert.equal(wooSelection({ ...env(), WOOCOMMERCE_ENABLED: 'false' }, item), null);
  assert.equal(getProvider(PRODUCTS[24]), 'printify'); assert.equal(getProvider(PRODUCTS[28]), 'printify'); assert.equal(getProvider(PRODUCTS[29]), 'printify');
  assert.equal(PRODUCTS[28].sizes.M, '403704');
});

test('Woo redirects are refused without forwarding credentials using the Workers-supported fetch mode', async () => {
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.equal(new URL(url).origin, 'https://store.example.com');
    assert.equal(options.redirect, 'manual');
    return new Response(null, {status: 302, headers: {Location: 'https://other.example.com/'}});
  };
  await assert.rejects(wooRequest(env(), 'lalilly-bridge'), /302/);
  assert.equal(requests, 1);
});
test('mapping is explicit; unmapped selections and duplicate entries fail closed', () => {
  assert.deepEqual(wooSelection(env(), item), mapping);
  assert.equal(wooSelection(env(), { id: 28, size: 'M' }), null);
  assert.throws(() => wooSelection(env(), { ...item, size: 'XL' }));
  const e = env(); const row = { ...mapping, size: 'M', color: 'White' };
  e.WOOCOMMERCE_VARIANTS_JSON = JSON.stringify({ 6: [row, row] });
  assert.throws(() => wooSelection(e, item));
  e.WOOCOMMERCE_VARIANTS_JSON = JSON.stringify({ 6: [{ ...row, attributes: [{ name: 'Size', option: 'M' }, { name: 'Color', option: 'Black' }] }] });
  assert.throws(() => wooSelection(e, item), /labels/);
});
test('live identity validation catches changed SKU and wrong attributes', async () => {
  mockCatalog(); await verifyWooVariant(env(), mapping, 2);
  await assert.rejects(verifyWooVariant(env(), { ...mapping, sku: 'WRONG' }, 2));
  await assert.rejects(verifyWooVariant(env(), { ...mapping, attributes: [{ name: 'Size', option: 'XL' }] }, 2));
});
test('mixed Woo/legacy carts and unapproved live checkout are blocked before payment', async () => {
  await assert.rejects(prepareWooCheckout(env(), [item, { id: 28, size: 'M', qty: 1 }], PRODUCTS, getPriceCents), /separately/);
  await assert.rejects(prepareWooCheckout({ ...env(), STRIPE_SECRET_KEY: 'sk_live_fake' }, [item], PRODUCTS, getPriceCents), /testing/);
});
test('Stripe amounts, discounts, tax, shipping, and customer address are reconciled', () => {
  const payload = buildWooImport(session(), snapshot(), stripeLines());
  assert.equal(payload.totalCents, 5549); assert.equal(payload.lines[0].totalCents, 4500); assert.equal(payload.discountCents, 1000);
  assert.equal(payload.lines[0].variationId, 101); assert.equal(payload.shipping.last_name, 'Smith');
  assert.equal(payload.billing.email, 'buyer@example.com'); assert.equal(payload.billing_address.line1, '2 Billing St');
  assert.equal(Object.hasOwn(payload.shipping, 'phone'), false);
  const withPhone = session(); withPhone.customer_details.phone = '+12025550123';
  const phonePayload = buildWooImport(withPhone, snapshot(), stripeLines());
  assert.equal(phonePayload.shipping.phone, '+12025550123');
  assert.equal(phonePayload.billing.phone, '+12025550123');
});
test('unpaid, wrong currency, changed price, mismatched session, and incomplete lines cannot import', () => {
  for (const s of [{ ...session(), payment_status: 'unpaid' }, { ...session(), currency: 'eur' }, { ...session(), id: 'cs_test_other' }, { ...session(), amount_total: 1 }]) assert.throws(() => buildWooImport(s, snapshot(), stripeLines()));
  const lines = stripeLines(); lines.data[0].amount_subtotal = 1;
  assert.throws(() => buildWooImport(session(), snapshot(), lines));
  assert.throws(() => buildWooImport(session(), snapshot(), { ...stripeLines(), has_more: true }));
});
test('zero-value promotional checkouts retain a Stripe reference without a payment intent', () => {
  const s = { ...session(), payment_status: 'no_payment_required', payment_intent: null, amount_total: 0, total_details: { amount_tax: 0, amount_discount: 5500 }, shipping_cost: { amount_subtotal: 0, amount_tax: 0, amount_total: 0 } };
  const lines = stripeLines(); Object.assign(lines.data[0], { amount_discount: 5500, amount_tax: 0, amount_total: 0 });
  const payload = buildWooImport(s, snapshot(), lines);
  assert.equal(payload.totalCents, 0); assert.equal(payload.transaction_id, s.id);
});
test('Woo checkout uses existing UI contract, ignores client price, and saves frozen mapping', async () => {
  const e = env(); let stripeBody;
  mockCatalog(async (url, options) => {
    assert.equal(new URL(url).host, 'api.stripe.com');
    stripeBody = new URLSearchParams(options.body);
    return json({ id: 'cs_test_new123456', url: 'https://checkout.stripe.com/test' });
  });
  const response = await checkout({ env: e, request: new Request('https://lillypug.com/api/create-checkout-session', { method: 'POST', body: JSON.stringify({ cart: [{ ...item, price: 1, variationId: 999 }] }) }) });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { url: 'https://checkout.stripe.com/test' });
  assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '2750');
  assert.equal(stripeBody.get('line_items[0][price_data][tax_behavior]'), 'exclusive');
  assert.equal(stripeBody.get('metadata[fulfillment]'), 'woocommerce');
  assert.equal(stripeBody.get('phone_number_collection[enabled]'), 'true');
  assert.equal(stripeBody.has('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]'), false);
  const saved = JSON.parse(await e.ORDERS.get(`woo-checkout:${stripeBody.get('metadata[woo_snapshot]')}`));
  assert.equal(saved.lines[0].woo.variationId, 101); assert.equal(saved.stripeSessionId, 'cs_test_new123456');
});
test('legacy checkout continues without Woo secrets or Woo requests', async () => {
  let stripeBody;
  globalThis.fetch = async (url, options) => { assert.equal(new URL(url).host, 'api.stripe.com'); stripeBody = new URLSearchParams(options.body); return json({ id: 'cs_test_legacy', url: 'https://checkout.stripe.com/legacy' }); };
  const response = await checkout({ env: { STRIPE_SECRET_KEY: 'sk_test_fake' }, request: new Request('https://lillypug.com/api/create-checkout-session', { method: 'POST', body: JSON.stringify({ cart: [{ id: 28, size: 'M', qty: 1 }] }) }) });
  assert.equal(response.status, 200); assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '4950');
  assert.deepEqual(JSON.parse(stripeBody.get('metadata[cart]')), [{ id: 28, qty: 1, size: 'M' }]);
  assert.equal(stripeBody.get('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]'), '5');
  assert.equal(stripeBody.get('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]'), '10');
  assert.equal(stripeBody.has('phone_number_collection[enabled]'), false);
});

test('the new Woo-only shirt cannot fall back when routing or mapping is disabled', async () => {
  assert.equal(getProvider(PRODUCTS[31]), 'woocommerce');
  globalThis.fetch = async () => { assert.fail('Disabled shirt must not contact Stripe or a supplier'); };
  for (const configuration of [{ WOOCOMMERCE_ENABLED: 'false' }, { WOOCOMMERCE_VARIANTS_JSON: '{}' }]) {
    const response = await checkout({ env: { ...env(), ...configuration }, request: new Request('https://lillypug.com/api/create-checkout-session', {method: 'POST', body: JSON.stringify({cart: [{id: 31, size: 'S', color: 'White', qty: 1}]})}) });
    assert.equal(response.ok, false);
    assert.match((await response.json()).error, /not available for checkout/);
  }
});

test('the approved shirt uses its real SKU mapping and server price', async () => {
  const selected = selectedMappings['31'].find(v => v.color === 'White' && v.size === 'S');
  const e = {...env(), WOOCOMMERCE_VARIANTS_JSON: JSON.stringify(selectedMappings)};
  let stripeBody;
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/lalilly-bridge')) return json({version: 1});
    if (parsed.pathname.endsWith(`/products/${selected.productId}`)) return json({id: selected.productId, status: 'publish', type: 'variable'});
    if (parsed.pathname.endsWith(`/variations/${selected.variationId}`)) return json({id: selected.variationId, sku: selected.sku, purchasable: true, stock_status: 'instock', attributes: selected.attributes});
    assert.equal(parsed.host, 'api.stripe.com');
    stripeBody = new URLSearchParams(options.body);
    return json({id: 'cs_test_shirt123456', url: 'https://checkout.stripe.com/test'});
  };
  const response = await checkout({env: e, request: new Request('https://lillypug.com/api/create-checkout-session', {method: 'POST', body: JSON.stringify({cart: [{id: 31, size: 'S', color: 'White', qty: 1, price: 1, variationId: 25}]})})});
  assert.equal(response.status, 200);
  assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '2650');
  const saved = JSON.parse(await e.ORDERS.get(`woo-checkout:${stripeBody.get('metadata[woo_snapshot]')}`));
  assert.equal(saved.lines[0].woo.variationId, 35);
  assert.equal(saved.lines[0].woo.sku, '1564302106440105990');
});

test('a Woo-only product in a legacy webhook never reaches another supplier', async () => {
  globalThis.fetch = async () => { assert.fail('Woo-only SKU must never reach Printful or Printify'); };
  const s = {...session(), metadata: {cart: JSON.stringify([{id: 31, color: 'White', size: 'S', qty: 1}])}};
  const response = await stripeWebhook({env: env(), request: await signedStripeRequest(s)});
  assert.match((await response.json()).error, /verified WooCommerce checkout snapshot/);
});

test('replacement shirt resolves all twelve size/color choices and rejects stale XXL', async () => {
  const e = {...env(), WOOCOMMERCE_VARIANTS_JSON: JSON.stringify(selectedMappings)};
  const rows = selectedMappings['31'];
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map(v => v.variationId)).size, 12);
  assert.equal(new Set(rows.map(v => v.sku)).size, 12);
  for (const color of ['Black', 'White']) {
    for (const size of ['S', 'M', 'L', 'XL', '2XL', '3XL']) {
      const selected = wooSelection(e, {id: 31, color, size, qty: 1});
      assert.equal(selected.productId, 30);
      assert.equal(selected.sku, PRODUCTS[31].variantsByColor[color][size]);
      assert.equal(getPriceCents(PRODUCTS[31], size, color), 2650);
      assert.ok(selected.attributes.some(a => a.name === 'Size' && a.option === size));
      assert.ok(selected.attributes.some(a => a.name === 'Color' && a.option === color));
    }
    assert.throws(() => wooSelection(e, {id: 31, color, size: 'XXL', qty: 1}));
  }
  const {readFile} = await import('node:fs/promises');
  const {runInNewContext} = await import('node:vm');
  const frontendProducts = [];
  runInNewContext(await readFile(new URL('../product-extra.js', import.meta.url), 'utf8'), {PRODUCTS: frontendProducts});
  const shirt = frontendProducts.find(p => p.id === 31);
  assert.deepEqual(Array.from(shirt.sizes), ['S', 'M', 'L', 'XL', '2XL', '3XL']);
  assert.equal(shirt.comingSoon, true);
  assert.match(shirt.description, /100% cotton.*200 gsm/);
});
test('Woo import uses only server snapshot; tests stay on hold even in processing mode', async () => {
  const e = { ...env(), WOOCOMMERCE_ORDER_MODE: 'processing' }; await e.ORDERS.put('woo-checkout:snapshot-token', JSON.stringify(snapshot()));
  let sent;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).endsWith('/lalilly-orders')); assert.equal(options.redirect, 'manual');
    assert.match(options.headers.Authorization, /^Basic /); sent = JSON.parse(options.body);
    return json({ id: 42, status: 'on-hold' });
  };
  await fulfillWooCheckout(e, session(), { checkout: { sessions: { listLineItems: async () => stripeLines() } } });
  assert.equal(sent.release, false); assert.equal(sent.external_id, session().id);
  assert.equal(JSON.parse(await e.ORDERS.get(`session:${session().id}`))[0].provider, 'woocommerce');
});
async function signedStripeRequest(data, type = 'checkout.session.completed') {
  const body = JSON.stringify({ id: 'evt_test', type, data: { object: data } });
  const stripe = new Stripe('sk_test_fake');
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_test' });
  return new Request('https://lillypug.com/api/stripe-webhook', { method: 'POST', body, headers: { 'stripe-signature': signature } });
}
test('real Stripe signature verification rejects forged events and ignores unpaid events', async () => {
  const e = env(); globalThis.fetch = async () => { throw new Error('Must not call a provider'); };
  assert.equal((await stripeWebhook({ env: e, request: new Request('https://lillypug.com/api/stripe-webhook', { method: 'POST', body: '{}' }) })).status, 400);
  assert.equal((await stripeWebhook({ env: e, request: await signedStripeRequest({ ...session(), payment_status: 'unpaid' }) })).status, 200);
});
test('signed paid event reaches Woo and retriable Woo failure returns 503', async () => {
  const e = env(); await e.ORDERS.put('woo-checkout:snapshot-token', JSON.stringify(snapshot()));
  globalThis.fetch = async (url) => String(url).includes('api.stripe.com') ? json(stripeLines()) : json({ id: 42, status: 'on-hold' });
  assert.equal((await stripeWebhook({ env: e, request: await signedStripeRequest(session()) })).status, 200);
  globalThis.fetch = async (url) => String(url).includes('api.stripe.com') ? json(stripeLines()) : new Response('{}', { status: 503 });
  assert.equal((await stripeWebhook({ env: e, request: await signedStripeRequest(session()) })).status, 503);
});
test('signed legacy Printify event retains product and variant fulfillment routing', async () => {
  const e = { ...env(), PRINTIFY_API_KEY: 'test', PRINTIFY_SHOP_ID: 'shop' }; let sent;
  globalThis.fetch = async (url, options) => { assert.ok(String(url).startsWith('https://api.printify.com/')); sent = JSON.parse(options.body); return json({ id: 'printify-order' }); };
  const s = { ...session(), metadata: { cart: JSON.stringify([{ id: 28, size: 'M', qty: 1 }]) } };
  const result = await stripeWebhook({ env: e, request: await signedStripeRequest(s) });
  assert.equal(result.status, 200); assert.equal(sent.line_items[0].variant_id, 403704); assert.equal(sent.external_id, s.id);
  assert.ok(await e.ORDERS.get('pfyorder:printify-order'));
});
async function wooSignature(body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('test-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))));
}
test('Woo HMAC rejects tampering and webhook fetches authoritative order without storing PII', async () => {
  const e = env(); const body = JSON.stringify({ id: 42 }); const signature = await wooSignature(body);
  assert.equal(await verifyWooSignature(body, signature, 'test-secret'), true);
  assert.equal(await verifyWooSignature(body + ' ', signature, 'test-secret'), false);
  await e.ORDERS.put('wooorder:42', JSON.stringify({ stripeSessionId: session().id, status: 'processing' }));
  globalThis.fetch = async () => json({ id: 42, status: 'completed', billing: { email: 'private@example.com' }, meta_data: [{ key: '_lalilly_stripe_session', value: session().id }] });
  const r = await wooWebhook({ env: e, request: new Request('https://lillypug.com/api/woocommerce-webhook', { method: 'POST', body, headers: { 'x-wc-webhook-signature': signature, 'x-wc-webhook-source': 'https://store.example.com/', 'x-wc-webhook-topic': 'order.updated' } }) });
  assert.equal(r.status, 200); assert.equal(JSON.parse(await e.ORDERS.get('wooorder:42')).status, 'processing');
  assert.ok(!(await e.ORDERS.get('wooorder:42')).includes('private@example.com'));
});
test('tracking never invents shipped status or accepts javascript URLs', () => {
  const e = { WOOCOMMERCE_TRACKING_META_KEY: 'observed_tracking' };
  assert.equal(wooTracking({ status: 'completed' }, e).status, 'processing');
  assert.equal(wooTracking({ status: 'refunded' }, e).status, 'refunded');
  const record = wooTracking({ status: 'completed', meta_data: [{ key: 'observed_tracking', value: [{ tracking_number: 'TRACK123', tracking_url: 'javascript:alert(1)', tracking_provider: 'Carrier' }] }] }, e);
  assert.equal(record.status, 'shipped'); assert.equal(record.trackingUrl, null); assert.equal(record.trackingNumber, 'TRACK123');
});
test('order status preserves legacy references and polls Woo without revealing customer data', async () => {
  const e = env(); await e.ORDERS.put('session:old', '123'); await e.ORDERS.put('pforder:123', JSON.stringify({ status: 'shipped', trackingNumber: 'OLD', email: 'private@example.com' }));
  let response = await orderStatus({ env: e, request: new Request('https://lillypug.com/api/order-status?session_id=old') });
  assert.equal((await response.json()).trackingNumber, 'OLD');
  await e.ORDERS.put('session:woo', JSON.stringify([{ provider: 'woocommerce', id: '42' }]));
  await e.ORDERS.put('wooorder:42', JSON.stringify({ stripeSessionId: session().id, status: 'processing' }));
  globalThis.fetch = async () => json({ id: 42, status: 'on-hold', meta_data: [{ key: '_lalilly_stripe_session', value: session().id }], billing: { email: 'private@example.com' } });
  response = await orderStatus({ env: e, request: new Request('https://lillypug.com/api/order-status?session_id=woo') });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.text(); assert.ok(!result.includes('private@example.com')); assert.equal(JSON.parse(result).fulfillmentStatus, 'on-hold');
});
test('static hosting does not expose deployment files or local secrets', async () => {
  for (const path of ['/deploy/woocommerce/.env', '/.dev.vars', '/.env', '/tests/woocommerce.test.mjs']) assert.equal((await middleware({ request: new Request(`https://lillypug.com${path}`), next: () => { throw new Error('Must block'); } })).status, 404);
  assert.equal((await middleware({ request: new Request('https://lillypug.com/shop.html'), next: async () => new Response('storefront', { headers: { 'Content-Type': 'text/html' } }) })).status, 200);
});
