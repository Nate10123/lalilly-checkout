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
};
