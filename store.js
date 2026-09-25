// ---- Shared product catalog, icon renderer, and cart logic ----
// Used by both index.html and product.html so they never drift out of sync.
// Cart is persisted to localStorage so it survives navigating between pages.

function pugIcon(fill, bg) {
  // Real brand emblem, used as a placeholder for products without a synced
  // photo yet. The emblem is black-on-transparent, so on dark product
  // backgrounds we flip it to white via CSS filter instead of the SVG's
  // old per-product fill/bg colors.
  const isDarkBg = bg === '#14120f';
  const style = isDarkBg
    ? 'filter: invert(1); width: 55%; height: 55%; object-fit: contain;'
    : 'width: 55%; height: 55%; object-fit: contain;';
  return `<img src="assets/lalilly-emblem.png" alt="LA LILLY" loading="lazy" style="${style}">`;
}

// Renders a real product photo when one exists (synced products only),
// otherwise falls back to the brand emblem. `imageOverride` lets a caller
// show a specific photo (e.g. the one tied to a selected color) instead of
// the product's default. Used for every product thumbnail across the site
// so swapping in a real photo later is just a one-line data change, not a
// template change.
function productMedia(product, imageOverride) {
  const img = imageOverride || product.image;
  if (img) {
    return `<img src="${img}" alt="${product.name}" loading="lazy">`;
  }
  return pugIcon(product.fill, product.bg);
}

// Returns the photo for a product given a selected color, falling back to
// the product's default image when that color has none set yet.
// Checks colorSizeImages first — products where the photo depends on BOTH
// the color/finish AND the size (e.g. stickers: Standard vs Holographic,
// each with their own 3x3/4x4/5.5x5.5 shots) need that combo looked up
// before falling back to the older single-dimension color-only or
// size-only image maps.
function getProductImage(product, colorName, sizeName) {
  if (colorName && sizeName && product.colorSizeImages
      && product.colorSizeImages[colorName] && product.colorSizeImages[colorName][sizeName]) {
    return product.colorSizeImages[colorName][sizeName];
  }
  if (colorName && product.colors) {
    const match = product.colors.find(c => c.name === colorName);
    if (match && match.image) return match.image;
  }
  if (sizeName && product.sizeImages && product.sizeImages[sizeName]) {
    return product.sizeImages[sizeName];
  }
  return product.image;
}

const PRODUCTS = [
  {
    id: 1, name: 'L Snapback Hat', cat: 'headwear', catLabel: 'Headwear',
    drop: 'la-lilly', dropLabel: 'La Lilly',
    price: 26.00, tag: null, fill: '#14120f', bg: '#d3ecab',
    image: 'assets/products/l-snapback-hat.png',
    images: [
      'assets/products/l-snapback-hat.png',
      'assets/products/l-snapback-hat-left-side.png',
      'assets/products/l-snapback-hat-right-side.png',
      'assets/products/l-snapback-hat-back.png',
    ],
    madeIn: 'China',
    description: "The one hat that's on every regular's head at the drop. Structured 6-panel snapback — firm front panel, full buckram, flat brim with 8 rows of stitching, embroidered L up front, grey under the visor. Acrylic-wool blend, one size fits most (22″–24″)."
  },
  {
    id: 2, name: 'Lilly Pug Pillow Plush', cat: 'accessories', catLabel: 'Accessories',
    drop: 'la-lilly', dropLabel: 'La Lilly',
    sizePricing: { '10″×10″': 18.50, '16″×16″': 21.50, '22″×22″': 25.00 },
    tag: null, fill: '#f7f3ec', bg: '#cfc5f5',
    sizes: ['10″×10″', '16″×16″', '22″×22″'],
    // Real per-size transparent product photos — swapped in on the PDP
    // as the size is picked (see selectSize in product.html).
    sizeImages: {
      '10″×10″': 'assets/products/pillow-10x10.png',
      '16″×16″': 'assets/products/pillow-16x16.png',
      '22″×22″': 'assets/products/pillow-22x22.png',
    },
    image: 'assets/products/pillow-16x16.png',
    madeIn: 'the USA',
    description: "Softer than she is grumpy in the mornings. A huggable, custom-shaped plush pillow printed with Lilly on one side, plain white on the back. 100% soft polyester, sealed with no zipper."
  },
  {
    id: 4, name: 'Metal Puggler Vintage Cap', cat: 'headwear', catLabel: 'Headwear',
    drop: 'puggler', dropLabel: 'Puggler',
    price: 29.50, tag: null, fill: '#f7f3ec', bg: '#a9d4f5',
    image: 'assets/products/puggler-vintage-cap-front.png',
    images: [
      'assets/products/puggler-vintage-cap-front.png',
      'assets/products/puggler-vintage-cap-left-side.png',
      'assets/products/puggler-vintage-cap-right-side.png',
      'assets/products/puggler-vintage-cap-back.png',
    ],
    // Real product spec via Printful sync: Otto Cap 18-1248 6-Panel Cotton
    // Twill Cap, Black. Only one variant is currently synced — Maroon was
    // dropped. Back embroidery design added Sept 2026; real front/back/
    // side mockups now in place.
    madeIn: 'China',
    description: "A 6-panel unstructured cap with a washed-out vintage finish and the Puggler logo embroidered front and back. Metal snap buckle with an antique brass finish, black sweatband, one size fits most."
  },
  {
    id: 5, name: 'FreakYe T-Shirt', cat: 'apparel', catLabel: 'Apparel',
    drop: 'lillye-west', dropLabel: 'LillYe West',
    sizePricing: { S: 29.50, M: 29.50, L: 29.50, XL: 29.50, '2XL': 31.50, '3XL': 34.50 },
    tag: 'new', fill: '#14120f', bg: '#a9d4f5',
    // 4XL removed — Printful no longer syncs that size for this product.
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    colors: [
      {
        name: 'Bone', hex: '#d9cdb8',
        image: 'assets/products/freakye-bone-front.png',
        images: [
          'assets/products/freakye-bone-front.png',
          'assets/products/freakye-bone-back.png',
          'assets/products/freakye-bone-details.png',
        ],
      },
      {
        name: 'White', hex: '#ffffff',
        image: 'assets/products/freakye-white-front.png',
        images: [
          'assets/products/freakye-white-front.png',
          'assets/products/freakye-white-back.png',
          'assets/products/freakye-white-details.png',
        ],
      },
    ],
    image: 'assets/products/freakye-white-front.png',
    madeIn: 'Bangladesh',
    description: "100% combed cotton, cut with a true-to-size regular fit and a classic crew neck. Pre-shrunk and double-needle stitched at the sleeves and hem so it holds up wash after wash, with a tear-away label if you don't want the size showing."
  },
  {
    id: 6, name: 'I ♥ Lilly Pug T-Shirt', cat: 'apparel', catLabel: 'Apparel',
    drop: 'la-lilly', dropLabel: 'La Lilly',
    // Re-synced from Printful: this blank (AS Colour 5001T) prices flat at
    // $27.50 across every size and both colors — was previously tiered
    // ($22.50 S-XL, up to $27.50 at 3XL), undercharging on all but 3XL.
    price: 27.50,
    tag: null, fill: '#ff2f7e', bg: '#ffe9a3',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    colors: [
      {
        name: 'Natural', hex: '#e3d6bb',
        image: 'assets/products/ilovelilly-natural-front.png',
        images: ['assets/products/ilovelilly-natural-front.png', 'assets/products/ilovelilly-natural-back.png'],
      },
      {
        name: 'White', hex: '#ffffff',
        image: 'assets/products/ilovelilly-white-front.png',
        images: ['assets/products/ilovelilly-white-front.png', 'assets/products/ilovelilly-white-back.png'],
      },
    ],
    image: 'assets/products/ilovelilly-white-front.png',
    madeIn: 'Bangladesh',
    description: "The classic. Simple, loud, and to the point. 100% combed cotton, pre-shrunk with a regular fit and crew neck, double-needle stitched at the sleeves and hem so the print holds up wash after wash."
  },
  {
    id: 7, name: 'Lilly Life Steel Water Bottle', cat: 'accessories', catLabel: 'Accessories',
    drop: 'lilly-life', dropLabel: 'Lilly Life',
    price: 28.00, tag: null, fill: '#f7f3ec', bg: '#a9d4f5', comingSoon: true,
    description: "Double-wall insulated stainless steel bottle, keeps drinks cold for 24 hours. Lilly Life logo laser-etched, not printed, so it won't wear off."
  },
  {
    id: 9, name: 'MLLGA Snapback Hat', cat: 'headwear', catLabel: 'Headwear',
    drop: 'lillye-west', dropLabel: 'LillYe West',
    price: 27.00, tag: 'new', fill: '#14120f', bg: '#d3ecab',
    image: 'assets/products/mllga-snapback-hat.png',
    images: [
      'assets/products/mllga-snapback-hat.png',
      'assets/products/mllga-snapback-hat-left-side.png',
      'assets/products/mllga-snapback-hat-right-side.png',
      'assets/products/mllga-snapback-hat-back.png',
    ],
    madeIn: 'China',
    description: "Structured 6-panel snapback built the right way — firm front panel, full buckram, and a flat brim with 8 rows of stitching. The MLLGA embroidery sits front and center, backed by pro-stitching on the crown and 6 eyelets that match the crown color. Acrylic-wool blend, one size fits most (22\u2033\u201324\u2033)."
  },
  {
    id: 10, name: 'Lillyzus Dad Hat', cat: 'headwear', catLabel: 'Headwear',
    drop: 'lillye-west', dropLabel: 'LillYe West',
    price: 26.50, tag: null, fill: '#f7f3ec', bg: '#cfc5f5',
    image: 'assets/products/lillyzus-dad-hat-front.png',
    images: [
      'assets/products/lillyzus-dad-hat-front.png',
      'assets/products/lillyzus-dad-hat-left-front.png',
      'assets/products/lillyzus-dad-hat-left-side.png',
      'assets/products/lillyzus-dad-hat-right-front.png',
      'assets/products/lillyzus-dad-hat-right-side.png',
      'assets/products/lillyzus-dad-hat-back.png',
    ],
    madeIn: 'Vietnam or Bangladesh',
    description: "Unstructured, low-profile dad hat in 100% cotton twill — 6 panels, pre-curved visor, adjustable strap with an antique buckle. \"LILLY\" is embroidered along the side panel, with a small pug emblem stitched on the back above the strap. Broken-in feel from the first wear."
  },
  {
    id: 11, name: 'PGLR Oversized Heavyweight Hoodie', cat: 'apparel', catLabel: 'Apparel',
    drop: 'puggler', dropLabel: 'Puggler',
    price: 54.50, tag: 'new', fill: '#f7f3ec', bg: '#f3aac2',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    image: 'assets/products/pglr-hoodie.png',
    images: [
      'assets/products/pglr-hoodie.png',
      'assets/products/pglr-hoodie-back.png',
    ],
    madeIn: 'Nicaragua',
    description: "Oversized heavyweight hoodie with the PGLR graphic on the back. Brushed fleece interior, double-layered hood (no drawcord), single front pocket, drop shoulders — built for actual cold weather."
  },
  {
    id: 12, name: 'Lillys Poster', cat: 'accessories', catLabel: 'Accessories',
    drop: 'lilly-verse', dropLabel: 'Lilly Verse',
    tag: 'new', fill: '#14120f', bg: '#f3aac2',
    sizes: ['21×30 cm', '30×40 cm', 'A2 (42×59.4 cm)', '50×70 cm', 'A1 (59.4×84.1 cm)', '70×100 cm'],
    sizePricing: {
      '21×30 cm': 12.00,
      '30×40 cm': 16.00,
      'A2 (42×59.4 cm)': 17.50,
      '50×70 cm': 20.00,
      'A1 (59.4×84.1 cm)': 23.00,
      '70×100 cm': 27.50,
    },
    image: 'assets/products/poster-50x70.png',
    sizeImages: {
      '21×30 cm': 'assets/products/poster-21x30.png',
      '30×40 cm': 'assets/products/poster-30x40.png',
      'A2 (42×59.4 cm)': 'assets/products/poster-a2.png',
      '50×70 cm': 'assets/products/poster-50x70.png',
      'A1 (59.4×84.1 cm)': 'assets/products/poster-a1.png',
      '70×100 cm': 'assets/products/poster-70x100.png',
    },
    // Paper is sourced from Japan for most orders. Brazil-bound orders use
    // USA-sourced paper instead (different paper stock per Printful's specs)
    // — not shown to customers since the site doesn't ship there yet.
    madeIn: 'Japan',
    // Standard (non-Brazil) paper specs, shown on the product page and
    // updated by size — see selectSize() in product.html. The "A4" note
    // only applies to 21×30 cm. Printful ships Brazil-bound orders on a
    // different, locally-sourced paper stock (Couche 170g Magno Sappi
    // Satin for 21×30/30×40/50×70, Koala Paper for 70×100+); the site
    // can't reflect that here because destination isn't known until
    // checkout, well after this panel renders.
    paperSpecs: {
      default: [
        'Paper thickness: 0.26 mm (10.3 mil)',
        'Paper weight: 189 g/m²',
        'Opacity: 94%',
        'ISO brightness: 104%',
        'Paper sourced from Japan',
      ],
      sizeNotes: {
        '21×30 cm': '21 × 30 cm posters are size A4.',
      },
    },
    description: "Matte enhanced-paper print of the Lillys artwork. Ships rolled in a protective tube. Pick your size below — bigger prints cost more to produce, so pricing scales with size."
  },
  {
    id: 13, name: 'La Lilly Bucket Hat', cat: 'headwear', catLabel: 'Headwear',
    drop: 'la-lilly', dropLabel: 'La Lilly',
    price: 24.50, tag: 'new', fill: '#14120f', bg: '#ffe9a3',
    image: 'https://files.cdn.printful.com/files/5f4/5f42cb966029647e7f0c520112c24732_preview.png',
    madeIn: 'China and Vietnam',
    description: "Cotton twill bucket hat with the LA LILLY wordmark embroidered up front. Sewn eyelets for breathability, one size fits most, sun's out dog's out."
  },
  {
    id: 14, name: "World's Best Lilly Glossy Mug", cat: 'accessories', catLabel: 'Accessories',
    drop: 'la-lilly', dropLabel: 'La Lilly',
    price: 8.50, tag: 'new', fill: '#14120f', bg: '#ffe9a3',
    image: 'https://files.cdn.printful.com/files/92a/92ad494b45d06d5e52f7b48735c9a00d_preview.png',
    madeIn: 'China',
    description: "11 oz glossy ceramic mug for your morning coffee and Lilly worship. Dishwasher and microwave safe."
  },
  {
    id: 15, name: 'The Puggler Heavyweight Tee', cat: 'apparel', catLabel: 'Apparel',
    drop: 'puggler', dropLabel: 'Puggler',
    sizePricing: { S: 26.50, M: 26.50, L: 26.50, XL: 26.50, '2XL': 27.50, '3XL': 28.50, '4XL': 29.50 },
    tag: 'new', fill: '#f7f3ec', bg: '#d3ecab',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    image: 'assets/products/puggler-tee-black.png',
    madeIn: 'Bangladesh',
    description: "Heavyweight cotton tee with THE PUGGLER graphic front and center. Ring-spun cotton, relaxed fit, ribbed lycra collar — cut from a thicker, sturdier blank than the rest of the tee lineup."
  },
  {
    id: 16, name: 'Lilly Bear Case for iPhone', cat: 'accessories', catLabel: 'Accessories',
    drop: 'la-lilly', dropLabel: 'La Lilly',
    price: 17.00, tag: 'new', fill: '#14120f', bg: '#ffe9a3',
    // "sizes" here are actually phone models, not clothing sizes — this
    // label is what makes the PDP say "Model" instead of "Size" and shows
    // "Choose a model" in the dropdown placeholder.
    sizeLabel: 'Model',
    // Same flat price across every model — just a different case mold per
    // phone. Newest models listed first for easier scrolling.
    sizes: [
      'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 17 Air', 'iPhone 17',
      'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
      'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
      'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
      'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13 mini', 'iPhone 13',
      'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12 mini', 'iPhone 12',
      'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
      'iPhone X/XS', 'iPhone XR', 'iPhone SE', 'iPhone 7/8',
    ],
    image: 'assets/products/lillybear-case-on-phone.png',
    images: [
      'assets/products/lillybear-case-on-phone.png',
      'assets/products/lillybear-case-with-phone.png',
    ],
    madeIn: 'China or South Korea',
    description: "Hybrid TPU/polycarbonate case — solid, durable back with flexible, secure sides. Raised bezel front, precisely aligned ports, wireless-charging compatible. Graphic is UV printed with a smooth matte finish."
  },
  {
    id: 17, name: "I'm Gay Oversized Tie-Dye T-Shirt", cat: 'apparel', catLabel: 'Apparel',
    drop: 'la-lilly', dropLabel: 'La Lilly',
    sizePricing: { S: 32.50, M: 32.50, L: 32.50, XL: 32.50, '2XL': 35.00 },
    tag: 'low', fill: '#14120f', bg: '#ffc4dd',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    // Per Printful (confirmed live on the product page, not just the
    // initial sync): Classic Rainbow M/L/XL/2XL are marked "Supplier out
    // of stock" — only S is orderable in that color right now. Sherbet
    // Rainbow is fully in stock across all sizes.
    unavailableSizes: {
      'Classic Rainbow': ['M', 'L', 'XL', '2XL'],
    },
    colors: [
      {
        name: 'Sherbet Rainbow', hex: '#ffc4dd',
        image: 'assets/products/tiedye-sherbet-front.png',
        images: [
          'assets/products/tiedye-sherbet-front.png',
          'assets/products/tiedye-sherbet-back.png',
          'assets/products/tiedye-sherbet-details.png',
        ],
      },
      {
        name: 'Classic Rainbow', hex: '#ff3b30',
        image: 'assets/products/tiedye-classic-front.png',
        images: [
          'assets/products/tiedye-classic-front.png',
          'assets/products/tiedye-classic-back.png',
          'assets/products/tiedye-classic-details.png',
        ],
      },
    ],
    image: 'assets/products/tiedye-sherbet-front.png',
    madeIn: 'Honduras',
    description: "Heavyweight oversized tie-dye tee — 100% US-grown cotton, 7.5 oz./yd² fabric, extended sleeves, and a ribbed neck. Every piece is hand-dyed, so no two shirts come out exactly alike."
  },
  {
    id: 18, name: 'Ye N Lillye Tri-Blend T-Shirt', cat: 'apparel', catLabel: 'Apparel',
    drop: 'lillye-west', dropLabel: 'LillYe West',
    sizePricing: { XS: 26.50, S: 26.50, M: 26.50, L: 26.50, XL: 26.50, '2XL': 28.50, '3XL': 30.00 },
    tag: 'new', fill: '#14120f', bg: '#f3aac2',
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    colors: [
      {
        name: 'Solid Black Triblend', hex: '#1a1a1a',
        image: 'assets/products/yenlillye-black-front.png',
        images: [
          'assets/products/yenlillye-black-front.png',
          'assets/products/yenlillye-black-back.png',
          'assets/products/yenlillye-black-details.png',
        ],
      },
      {
        name: 'Navy Triblend', hex: '#1b2a4a',
        image: 'assets/products/yenlillye-navy-front.png',
        images: [
          'assets/products/yenlillye-navy-front.png',
          'assets/products/yenlillye-navy-back.png',
          'assets/products/yenlillye-navy-details.png',
        ],
      },
      {
        name: 'Grey Triblend', hex: '#8c8c8c',
        image: 'assets/products/yenlillye-grey-front.png',
        images: [
          'assets/products/yenlillye-grey-front.png',
          'assets/products/yenlillye-grey-back.png',
          'assets/products/yenlillye-grey-details.png',
        ],
      },
      {
        name: 'Solid White Triblend', hex: '#ffffff',
        image: 'assets/products/yenlillye-white-front.png',
        images: [
          'assets/products/yenlillye-white-front.png',
          'assets/products/yenlillye-white-back.png',
          'assets/products/yenlillye-white-details.png',
        ],
      },
    ],
    image: 'assets/products/yenlillye-navy-front.png',
    madeIn: 'Guatemala, Nicaragua, Honduras, or the US',
    description: "Tri-blend tee — 50% polyester, 25% combed ring-spun cotton, 25% rayon, 3.4 oz/yd² fabric. Pre-shrunk, regular fit, side-seamed construction. The tri-blend gives the print a soft, slightly vintage look."
  },
  {
    id: 19, name: 'Emotions Of Lilly Classic Tee', cat: 'apparel', catLabel: 'Apparel',
    drop: 'la-lilly', dropLabel: 'La Lilly',
    sizePricing: { S: 16.50, M: 16.50, L: 16.50, XL: 16.50, '2XL': 18.50, '3XL': 21.00, '4XL': 23.50, '5XL': 26.00 },
    tag: 'new', fill: '#14120f', bg: '#ffe9a3',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
    colors: [
      {
        name: 'Cardinal', hex: '#a02334',
        image: 'assets/products/emotionsoflilly-cardinal-front.png',
        images: [
          'assets/products/emotionsoflilly-cardinal-front.png',
          'assets/products/emotionsoflilly-cardinal-back.png',
        ],
      },
      {
        name: 'Irish Green', hex: '#00843d',
        image: 'assets/products/emotionsoflilly-irishgreen-front.png',
        images: [
          'assets/products/emotionsoflilly-irishgreen-front.png',
          'assets/products/emotionsoflilly-irishgreen-back.png',
        ],
      },
      {
        name: 'Azalea', hex: '#e893b7',
        image: 'assets/products/emotionsoflilly-azalea-front.png',
        images: [
          'assets/products/emotionsoflilly-azalea-front.png',
          'assets/products/emotionsoflilly-azalea-back.png',
        ],
      },
      {
        name: 'Carolina Blue', hex: '#7ba4db',
        image: 'assets/products/emotionsoflilly-carolinablue-front.png',
        images: [
          'assets/products/emotionsoflilly-carolinablue-front.png',
          'assets/products/emotionsoflilly-carolinablue-back.png',
        ],
      },
      {
        name: 'White', hex: '#ffffff',
        image: 'assets/products/emotionsoflilly-white-front.png',
        images: [
          'assets/products/emotionsoflilly-white-front.png',
          'assets/products/emotionsoflilly-white-back.png',
        ],
      },
    ],
    image: 'assets/products/emotionsoflilly-white-front.png',
    madeIn: 'Honduras, Nicaragua, Haiti, Dominican Republic, Bangladesh, or Mexico',
    description: "Every mood Lilly's ever thrown our way, front and center. A structured, sturdy cotton tee — 100% cotton, 5.0–5.3 oz pre-shrunk jersey knit with taped neck and shoulders, double-stitched seams, and a tear-away label. Five colorways, all equally unbothered."
  },
  {
    id: 20, name: 'Lilly Verse T-shirt', cat: 'apparel', catLabel: 'Apparel',
    drop: 'lilly-verse', dropLabel: 'Lilly Verse',
    sizePricing: { XS: 25.00, S: 25.00, M: 25.00, L: 25.00, XL: 25.00, '2XL': 27.50, '3XL': 30.00, '4XL': 32.50, '5XL': 35.00 },
    tag: 'new', fill: '#14120f', bg: '#cfc5f5',
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
    // Not every color runs the full size range — Team Purple stops at 4XL,
    // Dark Grey only goes up to 2XL, per what's actually synced in Printful.
    unavailableSizes: {
      'Team Purple': ['5XL'],
      'Dark Grey': ['3XL', '4XL', '5XL'],
    },
    colors: [
      {
        name: 'Black', hex: '#1a1a1a',
        image: 'assets/products/lillyversetee-black-front.png',
        images: [
          'assets/products/lillyversetee-black-front.png',
          'assets/products/lillyversetee-black-back.png',
        ],
      },
      {
        name: 'Team Purple', hex: '#4b2e83',
        image: 'assets/products/lillyversetee-teampurple-front.png',
        images: [
          'assets/products/lillyversetee-teampurple-front.png',
          'assets/products/lillyversetee-teampurple-back.png',
        ],
      },
      {
        name: 'Navy', hex: '#212e45',
        image: 'assets/products/lillyversetee-navy-front.png',
        images: [
          'assets/products/lillyversetee-navy-front.png',
          'assets/products/lillyversetee-navy-back.png',
        ],
      },
      {
        name: 'Dark Grey', hex: '#4a4a4a',
        image: 'assets/products/lillyversetee-darkgrey-front.png',
        images: [
          'assets/products/lillyversetee-darkgrey-front.png',
          'assets/products/lillyversetee-darkgrey-back.png',
        ],
      },
    ],
    image: 'assets/products/lillyversetee-black-front.png',
    madeIn: 'Nicaragua, Mexico, Honduras, or the US',
    description: "The Lilly Verse graphic on soft, staple-tee cotton — combed, ring-spun cotton (heather colors run a cotton/poly blend), pre-shrunk, side-seamed, tear-away label. Runs from XS up to 5XL depending on color, so check the size row before you fall in love with Dark Grey."
  },
  {
    id: 21, name: 'Lilly Verse Stickers', cat: 'accessories', catLabel: 'Accessories',
    drop: 'lilly-verse', dropLabel: 'Lilly Verse',
    tag: 'new', fill: '#14120f', bg: '#d3ecab',
    sizes: ['3″×3″', '4″×4″', '5.5″×5.5″'],
    colors: [
      { name: 'Standard', hex: '#eef0ee' },
      { name: 'Holographic', hex: '#f6c9ec' },
    ],
    colorSizePricing: {
      Standard: { '3″×3″': 3.50, '4″×4″': 3.50, '5.5″×5.5″': 4.00 },
      Holographic: { '3″×3″': 5.50, '4″×4″': 6.00, '5.5″×5.5″': 6.50 },
    },
    colorSizeImages: {
      Standard: {
        '3″×3″': 'assets/products/lillyversesticker-white-3x3.png',
        '4″×4″': 'assets/products/lillyversesticker-white-4x4.png',
        '5.5″×5.5″': 'assets/products/lillyversesticker-white-5x5.png',
      },
      Holographic: {
        '3″×3″': 'assets/products/lillyversesticker-holo-3x3.png',
        '4″×4″': 'assets/products/lillyversesticker-holo-4x4.png',
        '5.5″×5.5″': 'assets/products/lillyversesticker-holo-5x5.png',
      },
    },
    image: 'assets/products/lillyversesticker-white-4x4.png',
    description: "Kiss-cut vinyl stickers straight from the Lilly Verse. Pick Standard for classic matte vinyl, or Holographic for a shimmer finish that shifts color in the light. Durable, waterproof, dishwasher-safe."
  },
  {
    id: 23, name: 'Zero Worries Oversized Faded T-shirt', cat: 'apparel', catLabel: 'Apparel',
    drop: 'lilly-life', dropLabel: 'Lilly Life',
    sizePricing: { S: 35.50, M: 35.50, L: 35.50, XL: 35.50, '2XL': 37.50, '3XL': 40.00 },
    tag: 'new', fill: '#14120f', bg: '#cfc5f5',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    colors: [
      {
        name: 'Faded Khaki', hex: '#b8ab86',
        image: 'assets/products/zeroworries-khaki-front.png',
        images: [
          'assets/products/zeroworries-khaki-front.png',
          'assets/products/zeroworries-khaki-back.png',
        ],
      },
      {
        name: 'Faded Eucalyptus', hex: '#8a9a85',
        image: 'assets/products/zeroworries-eucalyptus-front.png',
        images: [
          'assets/products/zeroworries-eucalyptus-front.png',
          'assets/products/zeroworries-eucalyptus-back.png',
        ],
      },
      {
        name: 'Faded Bone', hex: '#d8cfc0',
        image: 'assets/products/zeroworries-bone-front.png',
        images: [
          'assets/products/zeroworries-bone-front.png',
          'assets/products/zeroworries-bone-back.png',
        ],
      },
      {
        name: 'Faded White', hex: '#f2f0eb',
        image: 'assets/products/zeroworries-white-front.png',
        images: [
          'assets/products/zeroworries-white-front.png',
          'assets/products/zeroworries-white-back.png',
        ],
      },
    ],
    image: 'assets/products/zeroworries-eucalyptus-front.png',
    madeIn: 'China',
    description: "Boxy and oversized with a soft, faded wash — a relaxed drop-shoulder fit built for layering into everything else in the closet. Four muted colorways: Khaki, Eucalyptus, Bone, and White. Garment-dyed, pre-shrunk 100% carded cotton at 7.1 oz/yd² (240 g/m²), with wide neck ribbing and a tear-away label."
  },
  {
    id: 24, name: 'Lilly Pug is calling Chain', cat: 'accessories', catLabel: 'Accessories',
    drop: 'la-lilly', dropLabel: 'La Lilly',
    tag: null, fill: '#14120f', bg: '#e8c98a', comingSoon: false,
    // Fulfilled through Printify, not Printful — see functions/_shared/products.js.
    // One fixed jewelry size (1"×1"), so color is the only choice, and price
    // varies by metal/finish rather than by size.
    // TEMPORARY TEST PRICING — set to $1 across all colors on 2026-09-25 to
    // do a real end-to-end checkout test cheaply. Real prices were
    // Stainless $25.50 / Gold Plated $34.50 / Sterling Silver $59.50 —
    // restore those (or whatever you want to charge) before real customers
    // can buy this.
    colorPricing: {
      'Stainless Steel': 1.00,
      'Gold Plated': 1.00,
      'Sterling Silver': 1.00,
    },
    colors: [
      {
        name: 'Stainless Steel', hex: '#d4d5d1',
        image: 'assets/products/lillychain-stainless-steel-front.png',
      },
      {
        name: 'Gold Plated', hex: '#FEE3B4',
        image: 'assets/products/lillychain-gold-plated-front.png',
      },
      {
        name: 'Sterling Silver', hex: '#eeeeee',
        image: 'assets/products/lillychain-sterling-silver-front.png',
      },
    ],
    image: 'assets/products/lillychain-sterling-silver-front.png',
    madeIn: 'Laser-engraved to order',
    description: "The \"Lilly Pug is calling\" pendant — a round photo charm that turns Lilly's face into a permanent, laser-engraved incoming-call screen you wear. Comes on an 18\" cable chain in a gift box, ready to give. Choose Stainless Steel, Gold Plated, or Sterling Silver."
  },
];

const CART_KEY = 'lalilly_cart';
const RECENTLY_VIEWED_KEY = 'lalilly_recently_viewed';
const RECENTLY_VIEWED_LIMIT = 8;

// Records that a product was viewed, most-recent-first, capped at
// RECENTLY_VIEWED_LIMIT. Safe to call on every product page load.
function trackRecentlyViewed(id) {
  try {
    let ids = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
    ids = ids.filter(x => x !== id);
    ids.unshift(id);
    ids = ids.slice(0, RECENTLY_VIEWED_LIMIT);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids));
  } catch (e) {
    // Storage unavailable (private browsing, etc.) — just skip tracking.
  }
}

// Returns recently viewed products as full product objects, most-recent-first,
// excluding excludeId (typically the product currently being viewed).
function getRecentlyViewed(excludeId, limit) {
  let ids;
  try {
    ids = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
  } catch (e) {
    ids = [];
  }
  return ids
    .filter(id => id !== excludeId)
    .map(id => PRODUCTS.find(p => p.id === id))
    .filter(Boolean)
    .slice(0, limit || RECENTLY_VIEWED_LIMIT);
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (e) {
    // If storage is unavailable (private browsing, etc.), the cart just
    // won't persist across page loads — checkout on the current page still works.
  }
}

let cart = loadCart();

function addToCart(id, qty, btn, size, color) {
  qty = qty || 1;
  const product = PRODUCTS.find(p => p.id === id);
  if (!product || product.comingSoon) return;
  const existing = cart.find(c => c.id === id && c.size === size && c.color === color);
  if (existing) existing.qty += qty;
  else cart.push({ id: product.id, qty, size: size || undefined, color: color || undefined });
  saveCart(cart);
  updateCartUI();
  const badge = document.getElementById('cartCount');
  if (badge) {
    badge.classList.remove('pulse');
    void badge.offsetWidth; // restart the animation if it's already mid-pulse
    badge.classList.add('pulse');
  }
  if (btn) {
    const original = btn.textContent;
    btn.textContent = 'Added';
    btn.classList.add('added');
    setTimeout(() => { btn.textContent = original; btn.classList.remove('added'); }, 900);
  }
}

function removeFromCart(id, size, color) {
  cart = cart.filter(c => !(c.id === id && c.size === size && c.color === color));
  saveCart(cart);
  updateCartUI();
}

// Adjusts a cart line's quantity by delta (+1/-1). Removes the line entirely
// if it would drop to 0 or below.
function updateCartQty(id, size, color, delta) {
  const line = cart.find(c => c.id === id && c.size === size && c.color === color);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) {
    cart = cart.filter(c => c !== line);
  }
  saveCart(cart);
  updateCartUI();
}

function cartLinesWithProducts() {
  return cart
    .map(c => {
      const product = PRODUCTS.find(p => p.id === c.id);
      return product ? { ...product, qty: c.qty, size: c.size, color: c.color } : null;
    })
    .filter(Boolean);
}

// Returns the unit price for a product, accounting for size-based pricing
// (like the poster, where a bigger print costs more) — falls back to the
// product's flat price for everything else.
function getUnitPrice(product, size, color) {
  // Products priced per color alone, no size (the pendant's fixed jewelry
  // size means color is the only choice that affects price).
  if (product.colorPricing) {
    return color ? product.colorPricing[color] : null;
  }
  // Products where price depends on BOTH color/finish and size (stickers:
  // Standard vs Holographic each have their own 3x3/4x4/5.5x5.5 pricing)
  // need the combo looked up before the older single-dimension cases.
  if (product.colorSizePricing) {
    const sizeMap = color ? product.colorSizePricing[color] : null;
    return sizeMap && size ? sizeMap[size] : null;
  }
  if (product.sizePricing) {
    return size ? product.sizePricing[size] : null;
  }
  return product.price;
}

// For the shop grid / related-products cards, where no size is chosen yet:
// shows the flat price, or "From $X" (the cheapest size) for variable-price
// products like the poster.
function getDisplayPrice(product) {
  if (product.colorPricing) {
    const all = Object.values(product.colorPricing);
    return `From $${Math.min(...all).toFixed(2)}`;
  }
  if (product.colorSizePricing) {
    const all = Object.values(product.colorSizePricing).flatMap(sizeMap => Object.values(sizeMap));
    return `From $${Math.min(...all).toFixed(2)}`;
  }
  if (product.sizePricing) {
    const min = Math.min(...Object.values(product.sizePricing));
    return `From $${min.toFixed(2)}`;
  }
  return `$${product.price.toFixed(2)}`;
}

const FREE_SHIPPING_THRESHOLD = 90;

// Adds `days` business days (skipping Sat/Sun) to a date, returning a new Date.
function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function formatShortDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Domestic delivery estimate, matching the ranges on the Shipping Policy
// page: 3-7 business days processing, then 3-7 business days in transit.
function getEstimatedDeliveryRange() {
  const today = new Date();
  const earliest = addBusinessDays(today, 3 + 3);
  const latest = addBusinessDays(today, 7 + 7);
  return `${formatShortDate(earliest)} – ${formatShortDate(latest)}`;
}
const STANDARD_SHIPPING = 4.99;

function updateCartUI() {
  const lines = cartLinesWithProducts();
  const count = lines.reduce((sum, c) => sum + c.qty, 0);
  const subtotal = lines.reduce((sum, c) => sum + c.qty * getUnitPrice(c, c.size, c.color), 0);
  const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || lines.some(c => c.freeShipping);
  const shipping = subtotal === 0 ? 0 : (qualifiesForFreeShipping ? 0 : STANDARD_SHIPPING);
  const estimatedTotal = subtotal + shipping;

  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotal');
  if (countEl) countEl.textContent = count;
  if (totalEl) totalEl.textContent = '$' + estimatedTotal.toFixed(2);

  const subtotalEl = document.getElementById('drawerSubtotal');
  const shippingEl = document.getElementById('drawerShipping');
  const drawerTotalEl = document.getElementById('drawerTotal');
  if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
  if (shippingEl) {
    shippingEl.textContent = subtotal === 0 ? '—' : (shipping === 0 ? 'Free' : '$' + shipping.toFixed(2));
  }
  if (drawerTotalEl) drawerTotalEl.textContent = '$' + estimatedTotal.toFixed(2);

  const itemsEl = document.getElementById('cartItems');
  if (!itemsEl) return;

  if (lines.length === 0) {
    itemsEl.innerHTML = '<div class="cart-empty">Your cart is empty.<br>Go find something fragile.</div>';
    return;
  }
  itemsEl.innerHTML = lines.map(c => {
    const colorHex = c.color && c.colors ? (c.colors.find(x => x.name === c.color) || {}).hex : null;
    const colorDot = colorHex ? `<span class="cart-color-dot" style="background:${colorHex}"></span>` : '';
    const variantLabel = [c.color, c.size].filter(Boolean).join(' / ');
    const lineImage = getProductImage(c, c.color, c.size);
    const idArg = c.id;
    const sizeArg = c.size ? `'${c.size}'` : 'undefined';
    const colorArg = c.color ? `'${c.color}'` : 'undefined';
    return `
    <div class="cart-line">
      <div class="cart-line-art" style="background:${c.bg}">${productMedia(c, lineImage)}</div>
      <div class="cart-line-info">
        <h5>${colorDot}${c.name}${variantLabel ? ` — ${variantLabel}` : ''}</h5>
        <div class="cart-line-bottom">
          <div class="cart-qty-stepper">
            <button type="button" onclick="updateCartQty(${idArg}, ${sizeArg}, ${colorArg}, -1)" aria-label="Decrease quantity">−</button>
            <span>${c.qty}</span>
            <button type="button" onclick="updateCartQty(${idArg}, ${sizeArg}, ${colorArg}, 1)" aria-label="Increase quantity">+</button>
          </div>
          <span class="cart-line-price">$${(c.qty * getUnitPrice(c, c.size, c.color)).toFixed(2)}</span>
        </div>
      </div>
      <button class="cart-remove" onclick="removeFromCart(${idArg}, ${sizeArg}, ${colorArg})" aria-label="Remove item">Remove</button>
    </div>
  `;
  }).join('');
}

function toggleCart(open) {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('overlay');
  if (drawer) drawer.classList.toggle('open', open);
  if (overlay) overlay.classList.toggle('open', open);
}

function toggleMobileMenu() {
  const links = document.querySelector('.nav-links');
  const toggle = document.querySelector('.menu-toggle');
  if (!links || !toggle) return;
  const isOpen = links.classList.toggle('mobile-open');
  toggle.classList.toggle('active', isOpen);
  toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

// Close the mobile menu if the viewport grows past the mobile breakpoint,
// so it doesn't stay stuck open if someone rotates their phone or resizes.
window.addEventListener('resize', () => {
  if (window.innerWidth > 640) {
    const links = document.querySelector('.nav-links');
    const toggle = document.querySelector('.menu-toggle');
    if (links) links.classList.remove('mobile-open');
    if (toggle) { toggle.classList.remove('active'); toggle.setAttribute('aria-expanded', 'false'); }
  }
});

async function checkout() {
  if (cart.length === 0) return;
  const btn = document.querySelector('.checkout-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Loading…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: cart.map(c => ({ id: c.id, qty: c.qty, size: c.size, color: c.color })),
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // send customer to real Stripe Checkout
    } else {
      throw new Error(data.error || 'Checkout failed');
    }
  } catch (err) {
    alert(err.message || 'Checkout failed. Please try again.');
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const form = e.target;
  const note = document.getElementById('signupNote');
  const emailInput = document.getElementById('emailInput');
  const button = form.querySelector('button[type="submit"]');
  const email = emailInput.value.trim();

  note.textContent = '';
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Joining...';

  try {
    const res = await fetch('/api/newsletter-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      note.textContent = "You're on the list — welcome in.";
      emailInput.value = '';
    } else {
      note.textContent = data.error || "Something went wrong. Try again in a moment.";
    }
  } catch (err) {
    note.textContent = "Couldn't reach the signup service. Try again in a moment.";
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

// Update the cart badge as soon as the page loads, on every page that includes this file.
document.addEventListener('DOMContentLoaded', updateCartUI);

/* ---------- Marquee: auto-fill + seamless loop ---------- */
function initMarquee() {
  const marquee = document.querySelector('.marquee');
  const track = document.getElementById('marqueeTrack');
  if (!marquee || !track) return;

  const baseGroups = Array.from(track.children).map(g => g.cloneNode(true));
  if (!baseGroups.length) return;

  function buildMarquee() {
    track.innerHTML = '';
    baseGroups.forEach(g => track.appendChild(g.cloneNode(true)));

    // Keep adding copies until the content fills the visible bar at least once
    let guard = 0;
    while (track.scrollWidth < marquee.offsetWidth && guard < 20) {
      baseGroups.forEach(g => track.appendChild(g.cloneNode(true)));
      guard++;
    }

    // Duplicate the whole run once more so translateX(-50%) loops seamlessly
    Array.from(track.children).forEach(g => track.appendChild(g.cloneNode(true)));
  }

  buildMarquee();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildMarquee, 200);
  });
}

document.addEventListener('DOMContentLoaded', initMarquee);

/* ---------- Scroll reveal: fade/rise elements into view as the page scrolls ---------- */
function initScrollReveal() {
  const targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(el => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', initScrollReveal);
