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
// In the Printful dashboard, open the synced product, click into a
// specific size/color variant, and copy the ID shown there.

const PRODUCTS = {
  1: { name: 'L Snapback Hat', priceCents: 2600, printfulVariantId: null },
  2: { name: 'Lilly Pug Pillow Plush', priceCents: 1850, printfulVariantId: null },
  3: { name: 'Lilly Verse Holographic Stickers', priceCents: 550, printfulVariantId: null },
  4: { name: 'Metal Puggler Vintage Cap', priceCents: 2950, printfulVariantId: null },
  5: {
    name: 'FreakYe T-Shirt',
    priceCents: 2950,
    sizes: {
      S: '6a7ae473d411c5',
      M: '6a7ae473d411e6',
      L: '6a7ae473d411f1',
      XL: '6a7ae473d41207',
      '2XL': '6a7ae473d41211',
      '3XL': '6a7ae473d41223',
      '4XL': '6a7ae473d41233',
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
