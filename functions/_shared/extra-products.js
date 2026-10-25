// Small extension catalog for newly added products.
// Kept separate from the legacy catalog so new launches can be added safely.

export const EXTRA_PRODUCTS = {
  30: {
    name: 'Los Lillys New Pug Hat',
    sizePricingCents: {
      'S/M': 2950,
      'L/XL': 2950,
    },
    colors: ['Royal Blue'],
    variantsByColor: {
      'Royal Blue': {
        'S/M': '5567531573',
        'L/XL': '5567531574',
      },
    },
  },
  31: {
    name: 'XYZ Camo Big Pug Head Tee',
    provider: 'woocommerce',
    priceCents: 2792,
    colors: ['Black', 'White'],
    // SKU strings from the real Tapstitch-published Woo product (parent 11).
    // Checkout still requires the explicit environment mapping and live gates.
    variantsByColor: {
      Black: { S: '1563915623770349568', M: '1563915623770349569', L: '1563915623770349570', XL: '1563915623770349571', XXL: '1563915623770349572' },
      White: { S: '1563915623770349573', M: '1563915623770349574', L: '1563915623770349575', XL: '1563915623770349576', XXL: '1563915623770349577' },
    },
  },
};
