// Single source of truth for what you sell. Shared by both Cloudflare
// Pages Functions (checkout + fulfillment).

export const PRODUCTS = {
  1: { name: 'L Snapback Hat', priceCents: 2600, printfulVariantId: null },
  2: { name: 'Lilly Pug Pillow Plush', priceCents: 1850, printfulVariantId: null },
  3: { name: 'Lilly Verse Holographic Stickers', priceCents: 550, printfulVariantId: null },
  4: { name: 'Metal Puggler Vintage Cap', priceCents: 2950, printfulVariantId: null },
  5: {
    name: 'FreakYe T-Shirt',
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

  9: {
    name: 'MLLGA Snapback Hat',
    priceCents: 2700,
    printfulVariantId: '5442341940',
  },
  10: {
    name: 'Lillyzus Dad Hat',
    priceCents: 2650,
    printfulVariantId: '5442338297',
  },
  11: {
    name: 'PGLR Oversized Heavyweight Hoodie',
    priceCents: 5450,
    sizes: {
      S: '5442339209',
      M: '5442339210',
      L: '5442339211',
      XL: '5442339212',
      '2XL': '5442339213',
      '3XL': '5442339214',
    },
  },
  12: {
    name: 'Lillys Poster',
    // No flat priceCents — this product prices per size instead.
    sizePricingCents: {
      '21×30 cm': 1400,
      '30×40 cm': 1850,
      'A2 (42×59.4 cm)': 1950,
      '50×70 cm': 2350,
      'A1 (59.4×84.1 cm)': 2700,
      '70×100 cm': 3200,
    },
    sizes: {
      '21×30 cm': '5442339744',
      '30×40 cm': '5442339745',
      'A2 (42×59.4 cm)': '5442339743',
      '50×70 cm': '5442339746',
      'A1 (59.4×84.1 cm)': '5442339742',
      '70×100 cm': '5442339747',
    },
  },
};

// Returns the Printful variant ID for an order line, given a product and
// the size the customer picked (size is ignored for non-sized products).
export function getVariantId(product, size) {
  if (product.sizes) {
    return size ? product.sizes[size] : null;
  }
  return product.printfulVariantId;
}

// Returns the price (in cents) for a given product + size combination.
// Handles three cases: flat-priced products, sized products with one flat
// price regardless of size (e.g. the hoodie), and per-size pricing (the
// poster, where a bigger print genuinely costs more to produce).
export function getPriceCents(product, size) {
  if (product.sizePricingCents) {
    return size ? product.sizePricingCents[size] : null;
  }
  return product.priceCents;
}
