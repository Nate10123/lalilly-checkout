// Newly launched products that extend the main storefront catalog.
// Loaded immediately after store.js so shop/product pages can use them normally.

// Product 28 has one color, so product.html never calls selectColor() to switch
// to that color's image list. Mirror the front/back pair at the product level
// so the gallery is available immediately when the page renders.
const puggStoneWashTee = PRODUCTS.find(product => product.id === 28);
if (puggStoneWashTee) {
  const puggStoneWashImages = [
    'assets/products/pugg-stone-wash-heavy-tee-front.png?v=20261016-gallery',
    'assets/products/pugg-stone-wash-heavy-tee-back.png?v=20261016-gallery',
  ];
  puggStoneWashTee.image = puggStoneWashImages[0];
  puggStoneWashTee.images = puggStoneWashImages;
  if (puggStoneWashTee.colors && puggStoneWashTee.colors.length === 1) {
    puggStoneWashTee.colors[0].image = puggStoneWashImages[0];
    puggStoneWashTee.colors[0].images = puggStoneWashImages;
  }
}

PRODUCTS.push({
  id: 30,
  name: 'Los Lillys New Pug Hat',
  cat: 'headwear',
  catLabel: 'Headwear',
  drop: 'la-lilly',
  dropLabel: 'La Lilly',
  price: 29.50,
  tag: 'new',
  fill: '#f7f3ec',
  bg: '#A9D4F5',
  sizes: ['S/M', 'L/XL'],
  colors: [
    {
      name: 'Royal Blue',
      hex: '#244d9b',
      image: 'assets/products/los-lillys-pug-hat-front.png?v=20261022-png2',
      images: [
        'assets/products/los-lillys-pug-hat-front.png?v=20261022-png2',
        'assets/products/los-lillys-pug-hat-left-front.png?v=20261022-png2',
        'assets/products/los-lillys-pug-hat-left.png?v=20261022-png2',
        'assets/products/los-lillys-pug-hat-right-front.png?v=20261022-png2',
        'assets/products/los-lillys-pug-hat-right.png?v=20261022-png2',
        'assets/products/los-lillys-pug-hat-back.png?v=20261022-png2',
      ],
    },
  ],
  image: 'assets/products/los-lillys-pug-hat-front.png?v=20261022-png2',
  images: [
    'assets/products/los-lillys-pug-hat-front.png?v=20261022-png2',
    'assets/products/los-lillys-pug-hat-left-front.png?v=20261022-png2',
    'assets/products/los-lillys-pug-hat-left.png?v=20261022-png2',
    'assets/products/los-lillys-pug-hat-right-front.png?v=20261022-png2',
    'assets/products/los-lillys-pug-hat-right.png?v=20261022-png2',
    'assets/products/los-lillys-pug-hat-back.png?v=20261022-png2',
  ],
  madeIn: 'Vietnam or Bangladesh',
  description: 'Structured Flexfit cap with a clean mid-profile shape, curved visor, and silver undervisor. Made from a 63% polyester, 34% cotton, 3% spandex twill blend with a built-in stretch band for a comfortable fit, finished with 6 embroidered eyelets and sized to fit head circumferences from 22″–23⅞″.',
});

// The first Tapstitch launch uses the existing product page and cart styling.
// Keep the listing unavailable until customer checkout and supplier payment are enabled.
PRODUCTS.push({
  id: 31,
  name: 'XYZ Camo Big Pug Head Tee',
  cat: 'apparel',
  catLabel: 'Apparel',
  drop: 'la-lilly',
  dropLabel: 'La Lilly',
  price: 27.92,
  comingSoon: false,
  deliveryNote: 'Ships internationally after production; delivery time varies by destination.',
  tag: 'new',
  fill: '#f7f3ec',
  bg: '#e9e6df',
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  colors: [
    { name: 'Black', hex: '#111111', image: 'assets/products/lape-cotton-tee-black-front.jpg', images: ['assets/products/lape-cotton-tee-black-front.jpg', 'assets/products/lape-cotton-tee-black-back.jpg'] },
    { name: 'White', hex: '#ffffff', image: 'assets/products/lape-cotton-tee-white-front.jpg', images: ['assets/products/lape-cotton-tee-white-front.jpg', 'assets/products/lape-cotton-tee-white-back.jpg'] },
  ],
  image: 'assets/products/lape-cotton-tee-black-front.jpg',
  images: ['assets/products/lape-cotton-tee-black-front.jpg', 'assets/products/lape-cotton-tee-black-back.jpg'],
  description: 'A loose-fit, drop-shoulder tee in 100% cotton, 230 gsm (6.8 oz), with front and back DTF artwork and the approved sewn-in Lape Label. Made to order through international fulfillment. Machine wash gently at 30°C, tumble dry low, and avoid ironing the print.',
});

// Isolated test branch only; never merge this catalog override into main.
PRODUCTS.splice(0, PRODUCTS.length, ...PRODUCTS.filter(product => product.id === 31));
