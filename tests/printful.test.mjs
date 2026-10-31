import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { fulfillPrintfulOrder, printfulExternalId, printfulAutoAllowed, printfulAutoRequested, verifyPrintfulVariants } from '../functions/_shared/printful.js';
import { onRequestPost as webhook } from '../functions/api/stripe-webhook.js';
import { onRequestPost as startCheckout } from '../functions/api/create-checkout-session.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const env = { PRINTFUL_API_KEY: 'test-key', PRINTFUL_STORE_ID: '123', STRIPE_SECRET_KEY: 'sk_live_fake', STRIPE_WEBHOOK_SECRET: 'whsec_test', PRINTFUL_AUTO_FULFILL: 'true' };
const args = { stripeSessionId: 'cs_live_new_session', items: [{sync_variant_id: 123, quantity: 1}], recipient: {name: 'Test', country_code: 'US'}, autoConfirm: true };
const json = (value, status = 200) => Response.json(value, {status});
function supplier({ createTimeout = false, confirmTimeout = false, confirmFails = false } = {}) {
  const orders = new Map(); const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({url: String(url), method: options.method || 'GET'});
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(options.headers['X-PF-Store-Id'], '123');
    assert.equal(options.redirect, 'manual');
    const path = new URL(url).pathname;
    if (path.startsWith('/orders/@')) return orders.has(path.slice(9)) ? json({result: orders.get(path.slice(9))}) : json({},404);
    if (path === '/orders') {
      const body = JSON.parse(options.body);
      assert.equal(body.confirm, false);
      if (orders.has(body.external_id)) return json({},400);
      const order = {id: 456, status: 'draft', external_id: body.external_id};
      orders.set(body.external_id, order);
      if (createTimeout) throw new Error('Lost create response');
      return json({result: order});
    }
    if (path === '/orders/456/confirm') {
      if (confirmFails) return json({},500);
      const order = [...orders.values()][0]; order.status = 'pending';
      if (confirmTimeout) throw new Error('Lost confirm response');
      return json({result: order});
    }
    assert.fail('Unexpected supplier request');
  };
  return {orders, calls};
}

test('automatic confirmation needs an approved live key, paid live session and new server metadata', () => {
  const session = {livemode: true, payment_status: 'paid', amount_total: 3000, metadata: {printful_auto_fulfill: 'v1'}};
  assert.equal(printfulAutoRequested(env), true);
  assert.equal(printfulAutoAllowed(env, session), true);
  for (const settings of [{...env, PRINTFUL_AUTO_FULFILL:'false'}, {...env, STRIPE_SECRET_KEY:'sk_test_fake'}]) assert.equal(printfulAutoAllowed(settings,session),false);
  for (const changes of [{livemode:false}, {payment_status:'unpaid'}, {amount_total:0}, {metadata:{}}, {metadata:{printful_auto_fulfill:'true'}}]) assert.equal(printfulAutoAllowed(env,{...session,...changes}),false);
});

test('checkout freezes auto-confirm intent server-side and ignores client intent', async () => {
  for (const [settings, expected] of [[env,'v1'], [{...env, PRINTFUL_AUTO_FULFILL:'false'},null], [{...env, STRIPE_SECRET_KEY:'sk_test_fake'},null]]) {
    let payload;
    globalThis.fetch=async (url,options)=>{
      if (new URL(url).host==='api.printful.com') return json({result:{id:5442336899,synced:true,variant_id:123,availability_status:'active'}});
      assert.equal(new URL(url).host,'api.stripe.com'); payload=new URLSearchParams(options.body);
      return json({id:'cs_mock',url:'https://checkout.stripe.com/mock'});
    };
    const request=new Request('https://lillypug.com/api/create-checkout-session',{method:'POST',body:JSON.stringify({cart:[{id:1,qty:1}],printful_auto_fulfill:'v1'})});
    assert.equal((await startCheckout({env:settings,request})).status,200);
    assert.equal(payload.get('metadata[printful_auto_fulfill]'),expected);
  }
});

test('automatic checkout rejects stale, ignored or unsynced variants before payment', async () => {
  for (const variant of [{id:123,synced:false,variant_id:9}, {id:124,synced:true,variant_id:9}, {id:123,synced:true,is_ignored:true,variant_id:9}, {id:123,synced:true,variant_id:9,availability_status:'out_of_stock'}]) {
    globalThis.fetch=async()=>json({result:variant});
    await assert.rejects(()=>verifyPrintfulVariants(env,['123']),/not currently ready/);
  }
  let calls=0;
  globalThis.fetch=async()=>{calls++;return json({result:{id:123,synced:true,variant_id:9,availability_status:'active'}});};
  await verifyPrintfulVariants(env,['123','123']); assert.equal(calls,1);
});

test('Printful external IDs are stable, distinct and within the supplier 32-character limit', async () => {
  const id = await printfulExternalId('cs_live_abcdefgh');
  assert.equal(id, await printfulExternalId('cs_live_abcdefgh'));
  assert.match(id,/^[a-z0-9_]{32}$/);
  assert.notEqual(id,await printfulExternalId('cs_live_different'));
});

test('approved new order is created once and confirmed for production', async () => {
  const remote = supplier(); const result = await fulfillPrintfulOrder(env,args);
  assert.equal(result.id,'456'); assert.equal(result.status,'pending'); assert.equal(remote.orders.size,1);
  assert.equal(remote.calls.filter(c=>c.method==='POST').length,2);
});

test('review mode creates only a draft', async () => {
  const remote = supplier();
  assert.equal((await fulfillPrintfulOrder(env,{...args,autoConfirm:false})).status,'draft');
  assert.equal(remote.calls.some(c=>c.url.endsWith('/confirm')),false);
});

test('sequential and concurrent deliveries cannot create duplicate Printful orders', async () => {
  const remote = supplier();
  await Promise.all([fulfillPrintfulOrder(env,args),fulfillPrintfulOrder(env,args)]);
  const writes = remote.calls.filter(c=>c.method==='POST').length;
  await fulfillPrintfulOrder(env,args);
  assert.equal(remote.orders.size,1);
  assert.equal(remote.calls.filter(c=>c.method==='POST').length,writes);
});

test('lost create and confirmation responses recover the same accepted order', async () => {
  for (const failures of [{createTimeout:true}, {confirmTimeout:true}]) {
    const remote = supplier(failures);
    const result = await fulfillPrintfulOrder(env,args);
    assert.equal(result.status,'pending'); assert.equal(remote.orders.size,1);
  }
});

test('failed confirmation stays retryable and canceled orders are never resurrected', async () => {
  const remote = supplier({confirmFails:true});
  await assert.rejects(()=>fulfillPrintfulOrder(env,args),/confirmation failed/);
  [...remote.orders.values()][0].status='canceled';
  const before = remote.calls.filter(c=>c.method==='POST').length;
  assert.equal((await fulfillPrintfulOrder(env,args)).status,'canceled');
  assert.equal(remote.calls.filter(c=>c.method==='POST').length,before);
});

test('lookup outages never cause blind creation', async () => {
  globalThis.fetch = async (url,options)=>{assert.equal(options.method,undefined);return json({},503);};
  await assert.rejects(()=>fulfillPrintfulOrder(env,args),/lookup failed/);
});

function kv() { const data=new Map(); return {data,get:async key=>data.get(key)||null,put:async (key,value)=>{data.set(key,value);}}; }
async function signed(session) {
  const body=JSON.stringify({id:'evt_test',type:'checkout.session.completed',data:{object:session}});
  const stripe=new Stripe('sk_test_fake');
  return new Request('https://lillypug.com/api/stripe-webhook',{method:'POST',body,headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload:body,secret:'whsec_test'})}});
}
function checkout() {return {id:'cs_live_new_session',livemode:true,payment_status:'paid',amount_total:3000,metadata:{printful_auto_fulfill:'v1',cart:JSON.stringify([{id:1,qty:1}])},customer_details:{name:'Test Customer',email:'test@example.invalid',address:{line1:'Test',city:'Test',state:'NY',country:'US',postal_code:'10001'}}};}

test('Stripe test payments cannot create supplier orders by default', async () => {
  globalThis.fetch=async()=>assert.fail('Must not reach suppliers');
  const response=await webhook({env:{...env,ORDERS:kv()},request:await signed({...checkout(),livemode:false})});
  assert.equal(await response.text(),'test-payment-ignored');
});

test('signed live payment confirms once and replay preserves shipment tracking', async () => {
  const remote=supplier(); const storage=kv(); const settings={...env,ORDERS:storage};
  assert.equal((await webhook({env:settings,request:await signed(checkout())})).status,200);
  const record=JSON.parse(await storage.get('pforder:456'));
  await storage.put('pforder:456',JSON.stringify({...record,status:'shipped',trackingNumber:'TRACK'}));
  const before=remote.calls.length;
  assert.equal((await webhook({env:settings,request:await signed(checkout())})).status,200);
  assert.equal(remote.calls.length,before);
  assert.equal(JSON.parse(await storage.get('pforder:456')).trackingNumber,'TRACK');
  assert.equal(JSON.parse(await storage.get('pforder:456')).status,'shipped');
});

test('Printful failure returns 503 for Stripe retry instead of silently acknowledging', async () => {
  supplier({confirmFails:true});
  assert.equal((await webhook({env:{...env,ORDERS:kv()},request:await signed(checkout())})).status,503);
});

test('Printify successful deliveries are reused and shipment status survives a replay', async () => {
  const storage=kv(); let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++; assert.ok(String(url).startsWith('https://api.printify.com/'));
    assert.equal(JSON.parse(options.body).external_id,'cs_live_new_session');
    return json({id:'pfy-order'});
  };
  const settings={...env,ORDERS:storage,PRINTIFY_API_KEY:'test',PRINTIFY_SHOP_ID:'shop'};
  const session={...checkout(),metadata:{cart:JSON.stringify([{id:29,qty:1}])}};
  assert.equal((await webhook({env:settings,request:await signed(session)})).status,200);
  const old=JSON.parse(await storage.get('pfyorder:pfy-order'));
  await storage.put('pfyorder:pfy-order',JSON.stringify({...old,status:'shipped',trackingNumber:'TRACK'}));
  assert.equal((await webhook({env:settings,request:await signed(session)})).status,200);
  assert.equal(calls,1); assert.equal(JSON.parse(await storage.get('pfyorder:pfy-order')).status,'shipped');
});
