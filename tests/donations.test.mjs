import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {onRequestPost as donate} from '../functions/api/donation-checkout.js';
import {onRequestPost as webhook} from '../functions/api/stripe-webhook.js';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const env={STRIPE_SECRET_KEY:'sk_test_fake',STRIPE_WEBHOOK_SECRET:'whsec_test'};
const requestId='12345678-1234-4234-8234-123456789abc';
const request=(amount,origin='https://lillypug.com')=>new Request('https://lillypug.com/api/donation-checkout',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({amount,requestId})});
test('donations validate amounts and origin before Stripe is called',async()=>{
 globalThis.fetch=()=>assert.fail('No payment request allowed');
 for(const amount of ['0','500.01','-5','1e2','1.001',10]) assert.equal((await donate({env,request:request(amount)})).status,400);
 assert.equal((await donate({env,request:request('10','https://example.invalid')})).status,403);
});
test('donation checkout uses exact cents, fixed metadata and no supplier/cart/shipping data',async()=>{
 globalThis.fetch=async(url,options)=>{
  assert.equal(new URL(url).hostname,'api.stripe.com');
  const data=new URLSearchParams(options.body);
  assert.equal(data.get('line_items[0][price_data][unit_amount]'),'1025');
  assert.equal(data.get('metadata[purpose]'),'lalilly_donation');
  assert.equal(data.get('metadata[fulfillment]'),'none');
  assert.equal(data.get('submit_type'),'donate');
  assert.equal(data.has('shipping_address_collection[allowed_countries][0]'),false);
  assert.equal(data.has('metadata[cart]'),false);
  return Response.json({id:'cs_test_donation',url:'https://checkout.stripe.com/c/pay/test'});
 };
 const response=await donate({env,request:request('10.25')});assert.equal(response.status,200);assert.match((await response.json()).url,/checkout.stripe.com/);
});
test('signed paid donation and replay never call suppliers or order storage',async()=>{
 globalThis.fetch=()=>assert.fail('Donation must not contact any supplier');
 const stripe=new Stripe(env.STRIPE_SECRET_KEY);
 const payload=JSON.stringify({id:'evt_donation',type:'checkout.session.completed',data:{object:{id:'cs_donation',livemode:true,payment_status:'paid',amount_total:1000,metadata:{purpose:'lalilly_donation',fulfillment:'none'}}}});
 for(let i=0;i<2;i++){
  const req=new Request('https://lillypug.com/api/stripe-webhook',{method:'POST',body:payload,headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET})}});
  const response=await webhook({env,request:req});assert.equal(response.status,200);assert.equal(await response.text(),'donation-received');
 }
});
