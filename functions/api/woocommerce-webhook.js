import { wooOrigin, wooJson, refreshWooRecord } from '../_shared/woocommerce.js';

export async function verifyWooSignature(body, signature, secret) {
  if (!secret || !signature) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const bytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(body));
  } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  // WooCommerce's registration ping is form-encoded and may be unsigned.
  // It only verifies reachability; it can never update an order.
  if (request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(await request.text());
    return form.has('webhook_id') ? wooJson({ ok: true }) : wooJson({ error: 'Invalid ping' }, 400);
  }
  const body = await request.text();
  if (!await verifyWooSignature(body, request.headers.get('x-wc-webhook-signature'), env.WOOCOMMERCE_WEBHOOK_SECRET)) return wooJson({ error: 'Unauthorized' }, 401);
  try {
    if (new URL(request.headers.get('x-wc-webhook-source')).origin !== wooOrigin(env)) return wooJson({ error: 'Wrong source' }, 401);
    if (!['order.created', 'order.updated'].includes(request.headers.get('x-wc-webhook-topic'))) return wooJson({ ok: true });
    const order = JSON.parse(body);
    if (!Number.isSafeInteger(order.id) || order.id < 1) return wooJson({ error: 'Invalid order' }, 400);
    if (!env.ORDERS) return wooJson({ error: 'Storage missing' }, 503);
    const key = `wooorder:${order.id}`;
    const raw = await env.ORDERS.get(key);
    // Unknown orders are recovered by authenticated polling once the Stripe import completes.
    if (!raw) return wooJson({ ok: true });
    const record = await refreshWooRecord(env, order.id, JSON.parse(raw));
    await env.ORDERS.put(key, JSON.stringify(record));
    return wooJson({ ok: true });
  } catch { return wooJson({ error: 'Status update needs retry' }, 503); }
}
