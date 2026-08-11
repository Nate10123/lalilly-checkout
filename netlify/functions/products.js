// Single source of truth for what you sell.
//
// priceCents: what the customer pays (in cents), charged via Stripe.
// printfulVariantId: which exact Printful catalog variant gets produced
//   for this product (specific product + size + color combo).
//
// HOW TO FIND YOUR printfulVariantId:
// 1. In the Printful dashboard, go to Store > Products and create/sync
//    each product (upload your design, pick the blank + size + color).
// 2. Click into that synced product. Each size/color combo has its own
//    "Sync Variant". Click on one.
// 3. The variant ID is in the URL or the variant details panel — copy
//    the numeric ID and paste it below.
// (If a product needs to offer multiple sizes, you'd list each size as
// its own line item on the storefront, each pointing at a different
// printfulVariantId — this starter assumes one size per listed product
// to keep things simple.)

const PRODUCTS = {
  1: { name: 'L Snapback Hat', priceCents: 2600, printfulVariantId: null },
  2: { name: 'Lilly Pug Pillow Plush', priceCents: 1850, printfulVariantId: null },
  3: { name: 'Lilly Verse Holographic Stickers', priceCents: 550, printfulVariantId: null },
  4: { name: 'Metal Puggler Vintage Cap', priceCents: 2950, printfulVariantId: null },
  5: { name: 'FreakYe T-Shirt', priceCents: 2950, printfulVariantId: null },
  6: { name: 'I ♥ Lilly Pug T-Shirt', priceCents: 2250, printfulVariantId: null },
  7: { name: 'Lilly Life Steel Water Bottle', priceCents: 2800, printfulVariantId: null },
  8: { name: 'Lilly Logo Packable Jacket', priceCents: 5550, printfulVariantId: null },
};

module.exports = { PRODUCTS };
