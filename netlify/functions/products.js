// Single source of truth for what you sell.
//
// priceCents: what the customer pays (in cents), charged via Stripe.
//
// Two shapes for a product:
//
// 1) No sizes — one fixed item, one variant:
//    printfulVariantId: '...'
//
// 2) Has sizes — customer picks one on the product page:
//    sizes: { S: '...', M: '...', L: '...', ... }
//    (charges the same priceCents regardless of size)
//
// HOW TO FIND A VARIANT ID:
// Call GET https://api.printful.com/store/products/{product_id} with your
// API token. Each entry under "sync_variants" has a top-level "id" field —
// that plain number is the sync_variant_id to use here.

const PRODUCTS = {
  1: { name: 'L Snapback Hat', priceCents: 2600, printfulVariantId: null },
  2: { name: 'Lilly Pug Pillow Plush', priceCents: 1850, printfulVariantId: null },
  3: { name: 'Lilly Verse Holographic Stickers', priceCents: 550, printfulVariantId: null },
  4: { name: 'Metal Puggler Vintage Cap', priceCents: 2950, printfulVariantId: null },
  5: {
    name: 'FreakYe T-Shirt', // storefront display name — matches "Unisex garment-dyed heavyweight t-shirt" in Printful
    priceCents: 2950,
    sizes: {
      S: '5436880039',
      M: '5436880040',
      L: '5436880041',
      XL: '5436880042',
      '2XL': '5436880043',
      '3XL': '5436880044',
      '4XL': '5436880045',
    },
  },
  6: { name: 'I ♥ Lilly Pug T-Shirt', priceCents: 2250, printfulVariantId: null },
  7: { name: 'Lilly Life Steel Water Bottle', priceCents: 2800, printfulVariantId: null },
  8: { name: 'Lilly Logo Packable Jacket', priceCents: 5550, printfulVariantId: null },
};

// Returns the Printful variant ID for an order line, given a product and
// the size the customer picked (size is ignored for non-sized products).
function getVariantId(product, size) {
  if (product.sizes) {
    return size ? product.sizes[size] : null;
  }
  return product.printfulVariantId;
}

module.exports = { PRODUCTS, getVariantId };
