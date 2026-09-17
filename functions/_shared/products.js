// Single source of truth for what you sell. Shared by both Cloudflare
// Pages Functions (checkout + fulfillment).

export const PRODUCTS = {
  1: { name: 'L Snapback Hat', priceCents: 2600, printfulVariantId: '5442336899' },
  2: {
    name: 'Lilly Pug Pillow Plush',
    // Prices scale with size — pulled from Printful's real per-variant
    // retail prices, not a flat rate. Previously this charged the 10"
    // price for every size, undercharging on the two bigger ones.
    sizePricingCents: {
      '10″×10″': 1850,
      '16″×16″': 2150,
      '22″×22″': 2500,
    },
    sizes: {
      '10″×10″': '5442333234',
      '16″×16″': '5442333235',
      '22″×22″': '5442333236',
    },
  },
  4: {
    name: 'Metal Puggler Vintage Cap',
    // Re-synced from Printful: Maroon is no longer a synced variant (only
    // Black remains), and retail price is $29.50, not $30 — was previously
    // overcharging by 50¢ and would have failed fulfillment on any Maroon
    // order since that variant ID no longer exists.
    priceCents: 2950,
    printfulVariantId: '5484051741',
  },
  5: {
    name: 'FreakYe T-Shirt',
    // Prices scale with size — same story as the pillow. Printful charges
    // more for 2XL/3XL on this blank. Updated to match Printful's current
    // retail_price (was $30/$32.50/$35.50, dropped $1 across the board).
    sizePricingCents: {
      S: 2950,
      M: 2950,
      L: 2950,
      XL: 2950,
      '2XL': 3150,
      '3XL': 3450,
    },
    // Re-pulled from Printful's API — the old flat `sizes` map here was
    // stale (Printful had re-synced this product with new variant IDs,
    // added a Bone color, and dropped 4XL). Any order placed against the
    // old IDs would have failed fulfillment.
    colors: ['Bone', 'White'],
    variantsByColor: {
      Bone: {
        S: '5441455931',
        M: '5441455932',
        L: '5441455933',
        XL: '5441455934',
        '2XL': '5441455935',
        '3XL': '5441455936',
      },
      White: {
        S: '5441455937',
        M: '5441455938',
        L: '5441455939',
        XL: '5441455940',
        '2XL': '5441455941',
        '3XL': '5441455942',
      },
    },
  },
  6: {
    name: 'I ♥ Lilly Pug T-Shirt',
    // Re-synced from Printful: flat $27.50 across every size and color —
    // was previously tiered ($22.50 S-XL, up to $27.50 at 3XL), meaning the
    // site had been undercharging on every unit except 3XL.
    priceCents: 2750,
    // Color variants. Each color+size combo has its own numeric
    // sync_variant_id, same idea as the plain `sizes` map elsewhere in this
    // file. Pulled directly from Printful's API (GET /store/products/456170249).
    colors: ['Natural', 'White'],
    variantsByColor: {
      Natural: {
        S: '5442592141',
        M: '5442592142',
        L: '5442592143',
        XL: '5442592144',
        '2XL': '5442592145',
        '3XL': '5442592146',
      },
      White: {
        S: '5442592147',
        M: '5442592148',
        L: '5442592149',
        XL: '5442592150',
        '2XL': '5442592151',
        '3XL': '5442592152',
      },
    },
  },
  7: { name: 'Lilly Life Steel Water Bottle', priceCents: 2800, printfulVariantId: null },

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
  13: { name: 'La Lilly Bucket Hat', priceCents: 2450, printfulVariantId: '5485818267' },
  14: { name: 'White Glossy Mug', priceCents: 850, printfulVariantId: '5492513656' },
  15: {
    name: 'The Puggler Heavyweight Tee',
    sizePricingCents: {
      S: 2650,
      M: 2650,
      L: 2650,
      XL: 2650,
      '2XL': 2750,
      '3XL': 2850,
      '4XL': 2950,
    },
    sizes: {
      S: '5435872045',
      M: '5435872046',
      L: '5435872047',
      XL: '5435872048',
      '2XL': '5435872049',
      '3XL': '5435872050',
      '4XL': '5435872051',
    },
  },
};

// True if the product offers a color choice (I ♥ Lilly Pug Tee, for now).
export function hasColors(product) {
  return Array.isArray(product.colors) && product.colors.length > 0;
}

// True if the product needs a size choice — either the plain `sizes` map
// (most sized products) or, for colored products, a size nested under
// whichever color was picked.
export function hasSizes(product) {
  if (product.sizes && typeof product.sizes === 'object' && !Array.isArray(product.sizes)) {
    return true;
  }
  if (hasColors(product) && product.variantsByColor) {
    const firstColorVariants = product.variantsByColor[product.colors[0]];
    return !!firstColorVariants && typeof firstColorVariants === 'object';
  }
  return false;
}

// Returns the Printful variant ID for an order line, given a product and
// the size/color the customer picked (each ignored where not applicable).
export function getVariantId(product, size, color) {
  if (hasColors(product)) {
    const variants = color ? product.variantsByColor[color] : null;
    if (!variants) return null;
    return hasSizes(product) ? (size ? variants[size] : null) : variants;
  }
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
