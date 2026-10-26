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
    // Replacement DTG shirt, Tapstitch design 1563930564392837120, Woo parent 30.
    // Checkout still requires explicit environment mapping and live gates.
    variantsByColor: {
      Black: { "S": '1564302106440105984', "M": '1564302106440105985', "L": '1564302106440105986', "XL": '1564302106440105987', "2XL": '1564302106440105988', "3XL": '1564302106440105989' },
      White: { "S": '1564302106440105990', "M": '1564302106440105991', "L": '1564302106440105992', "XL": '1564302106440105993', "2XL": '1564302106440105994', "3XL": '1564302106440105995' },
    },
  },
};
