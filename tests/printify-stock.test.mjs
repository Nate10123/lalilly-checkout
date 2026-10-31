import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { verifyPrintifyVariants } from '../functions/_shared/printify.js';
import { onRequestPost as checkout } from '../functions/api/create-checkout-session.js';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const env={STRIPE_SECRET_KEY:'sk_test_fake',PRINTIFY_API_KEY:'test',PRINTIFY_SHOP_ID:'shop'};
const productId='6abb5dbbe688cdb5400d66ac';
const items=[{productId,variantId:403704,label:'Pugg Tee (M)'}];
test('available Printify variants are checked once per product and redirects cannot receive credentials',async()=>{
  let count=0;
  globalThis.fetch=async(url,options)=>{count++;assert.equal(options.redirect,'manual');return Response.json({id:productId,variants:[{id:403704,is_enabled:true,is_available:true}]});};
  await verifyPrintifyVariants(env,[...items,...items]); assert.equal(count,1);
});
test('out-of-stock or disabled Printify variants fail before a payment session exists',async()=>{
  for(const variant of [{id:403704,is_enabled:true,is_available:false},{id:403704,is_enabled:false,is_available:true}]){
    globalThis.fetch=async url=>{assert.equal(new URL(url).host,'api.printify.com');return Response.json({id:productId,variants:[variant]});};
    const response=await checkout({env,request:new Request('https://lillypug.com/api/create-checkout-session',{method:'POST',body:JSON.stringify({cart:[{id:28,size:'M',qty:1}]})})});
    assert.equal(response.status,409); assert.match((await response.json()).error,/unavailable/);
  }
});
test('missing products, unknown inventory and supplier outages cannot fall through to payment',async()=>{
  for(const response of [Response.json({id:productId,variants:[]}),Response.json({id:productId,variants:[{id:403704,is_enabled:true}]}),Response.json({}, {status:503})]){
    globalThis.fetch=async()=>response.clone(); await assert.rejects(()=>verifyPrintifyVariants(env,items));
  }
});
