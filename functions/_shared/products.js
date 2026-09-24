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
      '21×30 cm': 1200,
      '30×40 cm': 1600,
      'A2 (42×59.4 cm)': 1750,
      '50×70 cm': 2000,
      'A1 (59.4×84.1 cm)': 2300,
      '70×100 cm': 2750,
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
  14: { name: "World's Best Lilly Glossy Mug", priceCents: 850, printfulVariantId: '5492513656' },
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
  16: {
    name: 'Lilly Bear Case for iPhone',
    priceCents: 1700,
    sizes: {
      'iPhone 11 Pro Max': '5506038448',
      'iPhone 11 Pro': '5506038449',
      'iPhone 11': '5506038450',
      'iPhone 12 mini': '5506038451',
      'iPhone 12 Pro Max': '5506038452',
      'iPhone 12 Pro': '5506038453',
      'iPhone 12': '5506038454',
      'iPhone 13 mini': '5506038455',
      'iPhone 13 Pro Max': '5506038456',
      'iPhone 13 Pro': '5506038457',
      'iPhone 13': '5506038458',
      'iPhone 14 Plus': '5506038459',
      'iPhone 14 Pro Max': '5506038460',
      'iPhone 14 Pro': '5506038461',
      'iPhone 14': '5506038462',
      'iPhone 15 Plus': '5506038463',
      'iPhone 15 Pro Max': '5506038464',
      'iPhone 15 Pro': '5506038465',
      'iPhone 15': '5506038466',
      'iPhone 16 Plus': '5506038467',
      'iPhone 16 Pro Max': '5506038468',
      'iPhone 16 Pro': '5506038469',
      'iPhone 16': '5506038470',
      'iPhone 17 Air': '5506038471',
      'iPhone 17 Pro Max': '5506038472',
      'iPhone 17 Pro': '5506038473',
      'iPhone 17': '5506038474',
      'iPhone 7/8': '5506038475',
      'iPhone SE': '5506038476',
      'iPhone X/XS': '5506038477',
      'iPhone XR': '5506038478',
    },
  },
  17: {
    name: "I'm Gay Oversized Tie-Dye T-Shirt",
    sizePricingCents: {
      S: 3250,
      M: 3250,
      L: 3250,
      XL: 3250,
      '2XL': 3500,
    },
    colors: ['Sherbet Rainbow', 'Classic Rainbow'],
    variantsByColor: {
      'Sherbet Rainbow': {
        S: '5504756317',
        M: '5504756318',
        L: '5504756319',
        XL: '5504756320',
        '2XL': '5504756321',
      },
      // Per Printful's Sept 2026 sync, only S is "active" in Classic
      // Rainbow — M/L/XL/2XL are "temporary_out_of_stock". Variant IDs
      // are kept here since Printful may restock, but ordering those four
      // combos right now would likely fail fulfillment. Flagged to Nate —
      // worth disabling those specific size chips on the PDP until
      // Printful shows them active again.
      'Classic Rainbow': {
        S: '5504756322',
        M: '5504756323',
        L: '5504756324',
        XL: '5504756325',
        '2XL': '5504756326',
      },
    },
  },
  18: {
    name: 'Ye N Lillye Tri-Blend T-Shirt',
    sizePricingCents: {
      XS: 2650,
      S: 2650,
      M: 2650,
      L: 2650,
      XL: 2650,
      '2XL': 2850,
      '3XL': 3000,
    },
    colors: ['Solid Black Triblend', 'Navy Triblend', 'Grey Triblend', 'Solid White Triblend'],
    variantsByColor: {
      'Solid Black Triblend': {
        XS: '5508694474', S: '5508694475', M: '5508694476', L: '5508694477',
        XL: '5508694478', '2XL': '5508694479', '3XL': '5508694480',
      },
      'Navy Triblend': {
        XS: '5508694481', S: '5508694482', M: '5508694483', L: '5508694484',
        XL: '5508694485', '2XL': '5508694486', '3XL': '5508694487',
      },
      'Grey Triblend': {
        XS: '5508694488', S: '5508694489', M: '5508694490', L: '5508694491',
        XL: '5508694492', '2XL': '5508694493', '3XL': '5508694494',
      },
      'Solid White Triblend': {
        XS: '5508694495', S: '5508694496', M: '5508694497', L: '5508694498',
        XL: '5508694499', '2XL': '5508694500', '3XL': '5508694501',
      },
    },
  },
  19: {
    name: 'Emotions Of Lilly Classic Tee',
    sizePricingCents: {
      S: 1650, M: 1650, L: 1650, XL: 1650,
      '2XL': 1850, '3XL': 2100, '4XL': 2350, '5XL': 2600,
    },
    colors: ['Cardinal', 'Irish Green', 'Azalea', 'Carolina Blue', 'White'],
    // sync_product_id changed from 473802847 to 474087086 on 2026-09-20 —
    // Printful created a new synced product instead of updating the old
    // one in place, so every variant ID below was re-pulled fresh.
    variantsByColor: {
      Cardinal: {
        S: '5511843523', M: '5511843524', L: '5511843525', XL: '5511843526',
        '2XL': '5511843527', '3XL': '5511843528', '4XL': '5511843529', '5XL': '5511843530',
      },
      'Irish Green': {
        S: '5511843531', M: '5511843532', L: '5511843534', XL: '5511843541',
        '2XL': '5511843550', '3XL': '5511843558', '4XL': '5511843560', '5XL': '5511843561',
      },
      Azalea: {
        S: '5511843562', M: '5511843563', L: '5511843564', XL: '5511843565',
        '2XL': '5511843566', '3XL': '5511843567', '4XL': '5511843568', '5XL': '5511843569',
      },
      'Carolina Blue': {
        S: '5511843570', M: '5511843571', L: '5511843572', XL: '5511843573',
        '2XL': '5511843574', '3XL': '5511843575', '4XL': '5511843576', '5XL': '5511843578',
      },
      White: {
        S: '5511843579', M: '5511843580', L: '5511843581', XL: '5511843582',
        '2XL': '5511843583', '3XL': '5511843584', '4XL': '5511843585', '5XL': '5511843586',
      },
    },
  },
  20: {
    name: 'Lilly Verse T-shirt',
    sizePricingCents: {
      XS: 2500, S: 2500, M: 2500, L: 2500, XL: 2500,
      '2XL': 2750, '3XL': 3000, '4XL': 3250, '5XL': 3500,
    },
    // Team Purple and Dark Grey don't run the full size range — Printful
    // only synced what's shown here, so those colors simply have no key
    // for the missing sizes (matches store.js's unavailableSizes).
    colors: ['Black', 'Team Purple', 'Navy', 'Dark Grey'],
    variantsByColor: {
      Black: {
        XS: '5510703941', S: '5510703942', M: '5510703943', L: '5510703944',
        XL: '5510703945', '2XL': '5510703946', '3XL': '5510703947', '4XL': '5510703948',
        '5XL': '5510703949',
      },
      'Team Purple': {
        XS: '5510703950', S: '5510703951', M: '5510703952', L: '5510703953',
        XL: '5510703954', '2XL': '5510703955', '3XL': '5510703956', '4XL': '5510703957',
      },
      Navy: {
        XS: '5510703958', S: '5510703959', M: '5510703960', L: '5510703961',
        XL: '5510703962', '2XL': '5510703963', '3XL': '5510703964', '4XL': '5510703965',
        '5XL': '5510703966',
      },
      'Dark Grey': {
        XS: '5510703967', S: '5510703968', M: '5510703969', L: '5510703970',
        XL: '5510703971', '2XL': '5510703972',
      },
    },
  },
  21: {
    name: 'Lilly Verse Stickers',
    colorSizePricingCents: {
      Standard: { '3″×3″': 350, '4″×4″': 350, '5.5″×5.5″': 400 },
      Holographic: { '3″×3″': 550, '4″×4″': 600, '5.5″×5.5″': 650 },
    },
    colors: ['Standard', 'Holographic'],
    variantsByColor: {
      Standard: {
        '3″×3″': '5510718023', '4″×4″': '5510718024', '5.5″×5.5″': '5510718025',
      },
      Holographic: {
        '3″×3″': '5510718082', '4″×4″': '5510718083', '5.5″×5.5″': '5510718084',
      },
    },
  },
  23: {
    name: 'Zero Worries Oversized Faded T-shirt',
    sizePricingCents: {
      S: 3550, M: 3550, L: 3550, XL: 3550, '2XL': 3750, '3XL': 4000,
    },
    colors: ['Faded Khaki', 'Faded Eucalyptus', 'Faded Bone', 'Faded White'],
    variantsByColor: {
      'Faded Khaki': {
        S: '5511846871', M: '5511846872', L: '5511846873', XL: '5511846874',
        '2XL': '5511846875', '3XL': '5511846876',
      },
      'Faded Eucalyptus': {
        S: '5511846877', M: '5511846878', L: '5511846879', XL: '5511846880',
        '2XL': '5511846881', '3XL': '5511846882',
      },
      'Faded Bone': {
        S: '5511846883', M: '5511846884', L: '5511846885', XL: '5511846886',
        '2XL': '5511846887', '3XL': '5511846888',
      },
      'Faded White': {
        S: '5511846889', M: '5511846890', L: '5511846891', XL: '5511846892',
        '2XL': '5511846893', '3XL': '5511846894',
      },
    },
  },
};

// Which print-on-demand provider fulfills a product. Defaults to Printful
// since that's every product before Printify was added — only new products
// that explicitly set `provider: 'printify'` route the other way. To add a
// Printify product: set `provider: 'printify'`, `printifyProductId` (the
// product's own id, from GET /v1/shops/{shop_id}/products.json), and put
// each variant's numeric `id` from that same response into `sizes` /
// `variantsByColor` / `printifyVariantId` exactly like a Printful product —
// getVariantId() below doesn't care which provider a variant ID belongs to.
export function getProvider(product) {
  return product.provider === 'printify' ? 'printify' : 'printful';
}

// Only meaningful for Printify products — Printify variant IDs are only
// unique *within* a product, so placing an order needs both.
export function getPrintifyProductId(product) {
  return product.printifyProductId || null;
}

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
  // Flat (no size/color) product — whichever provider field is set wins.
  return product.printfulVariantId ?? product.printifyVariantId ?? null;
}

// Returns the price (in cents) for a given product + size combination.
// Handles three cases: flat-priced products, sized products with one flat
// price regardless of size (e.g. the hoodie), and per-size pricing (the
// poster, where a bigger print genuinely costs more to produce).
export function getPriceCents(product, size, color) {
  // Products priced per color+size combo (the stickers' Standard vs
  // Holographic finishes each have their own 3x3/4x4/5.5x5.5 pricing)
  // need the combo looked up before the older single-dimension cases.
  if (product.colorSizePricingCents) {
    const sizeMap = color ? product.colorSizePricingCents[color] : null;
    return sizeMap && size ? sizeMap[size] : null;
  }
  if (product.sizePricingCents) {
    return size ? product.sizePricingCents[size] : null;
  }
  return product.priceCents;
}
