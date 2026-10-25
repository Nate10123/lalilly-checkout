// Read-only. Run with: node --env-file=.dev.vars scripts/woocommerce-check.mjs [--catalog]
import { wooRequest, wooSelection, verifyWooVariant } from '../functions/_shared/woocommerce.js';
const env = process.env;
try {
  const bridge = await wooRequest(env, 'lalilly-bridge');
  if (bridge.version !== 1) throw new Error('Unexpected bridge version.');
  console.log(JSON.stringify({ reachable: true, bridgeVersion: bridge.version, paidOrdersEnabled: bridge.paid_orders_enabled }));
  if (process.argv.includes('--catalog')) {
    for (let page = 1; ; page++) {
      const products = await wooRequest(env, `products?per_page=100&page=${page}`);
      for (const p of products) {
        const variants = [];
        if (p.type === 'variable') {
          for (let vPage = 1; ; vPage++) {
            const batch = await wooRequest(env, `products/${p.id}/variations?per_page=100&page=${vPage}`);
            variants.push(...batch);
            if (batch.length < 100) break;
          }
        } else variants.push(p);
        for (const v of variants) console.log(JSON.stringify({ productId: p.id, name: p.name, variationId: p.type === 'variable' ? v.id : 0, sku: v.sku, attributes: v.attributes, stockStatus: v.stock_status }));
      }
      if (products.length < 100) break;
    }
  } else {
    const mappings = JSON.parse(env.WOOCOMMERCE_VARIANTS_JSON || '{}');
    for (const [id, entries] of Object.entries(mappings)) {
      for (const entry of entries) {
        const selected = wooSelection({ ...env, WOOCOMMERCE_ENABLED: 'true' }, { id, size: entry.size, color: entry.color });
        await verifyWooVariant(env, selected, 1);
      }
    }
    console.log('Configured variant mappings verified. No products or orders were changed.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
