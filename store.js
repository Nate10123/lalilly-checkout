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
// otherwise falls back to the brand emblem. Used for every product
// thumbnail across the site so swapping in a real photo later is just a
// one-line data change, not a template change.
function productMedia(product) {
  if (product.image) {
    return `<img src="${product.image}" alt="${product.name}" loading="lazy">`;
  }
  return pugIcon(product.fill, product.bg);
}

const PRODUCTS = [
  {
    id: 1, name: 'L Snapback Hat', cat: 'headwear', catLabel: 'Headwear',
    price: 26.00, tag: 'low', fill: '#14120f', bg: '#c8ff4d',
    image: 'https://files.cdn.printful.com/files/b00/b00ae06bed4412146f334b3c631b79f3_preview.png',
    description: "The one hat that's on every regular's head at the drop. Structured 6-panel snapback with an embroidered L, flat brim, adjustable snap closure. Runs true to size."
  },
  {
    id: 2, name: 'Lilly Pug Pillow Plush', cat: 'accessories', catLabel: 'Accessories',
    price: 18.50, tag: null, fill: '#f7f3ec', bg: '#ff2f7e',
    sizes: ['10″×10″', '16″×16″', '22″×22″'],
    image: 'https://files.cdn.printful.com/files/f7c/f7c9041b612004733c462899cb5c0682_preview.png',
    description: "Softer than she is grumpy in the mornings. A huggable plush pillow shaped like the one and only Lilly, stitched detailing, machine washable cover."
  },
  {
    id: 3, name: 'Lilly Verse Holographic Stickers', cat: 'accessories', catLabel: 'Accessories',
    price: 5.50, tag: 'new', fill: '#14120f', bg: '#b6a6ff',
    description: "Weatherproof holographic sticker pack from the Lilly Verse collection. Shifts color in the light. Built for laptops, water bottles, and skateboard decks alike."
  },
  {
    id: 4, name: 'Metal Puggler Vintage Cap', cat: 'headwear', catLabel: 'Headwear',
    price: 29.50, tag: null, fill: '#f7f3ec', bg: '#14120f',
    description: "Garment-washed dad cap with a distressed metal Puggler patch up front. Unstructured fit, curved brim, broken-in from day one."
  },
  {
    id: 5, name: 'FreakYe T-Shirt', cat: 'apparel', catLabel: 'Apparel',
    price: 29.50, tag: 'new', fill: '#14120f', bg: '#f7f3ec',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    image: 'https://files.cdn.printful.com/files/35b/35b29be98ad06f38f289fbe24c7251a4_preview.png',
    description: "Heavyweight cotton tee with the FreakYe graphic front and center. Boxy fit, garment-dyed for a worn-in feel right out of the bag."
  },
  {
    id: 6, name: 'I ♥ Lilly Pug T-Shirt', cat: 'apparel', catLabel: 'Apparel',
    price: 22.50, tag: null, fill: '#ff2f7e', bg: '#f7f3ec',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    image: 'https://files.cdn.printful.com/files/f61/f613509dbec2a8355bd6395661dd1c17_preview.png',
    description: "The classic. Simple, loud, and to the point. Soft 100% cotton, unisex fit, screen-printed graphic that won't crack or fade."
  },
  {
    id: 7, name: 'Lilly Life Steel Water Bottle', cat: 'accessories', catLabel: 'Accessories',
    price: 28.00, tag: null, fill: '#f7f3ec', bg: '#c8ff4d',
    description: "Double-wall insulated stainless steel bottle, keeps drinks cold for 24 hours. Lilly Life logo laser-etched, not printed, so it won't wear off."
  },
  {
    id: 8, name: 'Lilly Logo Packable Jacket', cat: 'apparel', catLabel: 'Apparel',
    price: 55.50, tag: 'low', fill: '#f7f3ec', bg: '#b6a6ff',
    description: "Lightweight windbreaker that packs into its own pocket. Embroidered logo on the chest, water-resistant shell, built for that one dog walk that turns into a downpour."
  },
  {
    id: 9, name: 'MLLGA Snapback Hat', cat: 'headwear', catLabel: 'Headwear',
    price: 27.00, tag: 'new', fill: '#14120f', bg: '#ff2f7e',
    image: 'https://files.cdn.printful.com/files/fcb/fcb298bce7dbbe42adfa59abc5d5973f_preview.png',
    description: "Structured wool-blend snapback with the MLLGA embroidery front and center. Flat brim, adjustable snap closure, one size fits most."
  },
  {
    id: 10, name: 'Lillyzus Dad Hat', cat: 'headwear', catLabel: 'Headwear',
    price: 26.50, tag: null, fill: '#f7f3ec', bg: '#14120f',
    image: 'https://files.cdn.printful.com/files/6fb/6fb7c4913cfca43d8127c46c74395f8d_preview.png',
    description: "Unstructured classic dad cap with the Lillyzus embroidery on the back. Soft crown, curved brim, broken-in feel from the first wear."
  },
  {
    id: 11, name: 'PGLR Oversized Heavyweight Hoodie', cat: 'apparel', catLabel: 'Apparel',
    price: 54.50, tag: 'new', fill: '#f7f3ec', bg: '#14120f',
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    image: 'https://files.cdn.printful.com/files/575/57545f8cf56d3354f5ff11b68945ca03_preview.png',
    description: "Oversized heavyweight hoodie with the PGLR graphic on the back. Drop shoulders, thick fleece lining, built for actual cold weather."
  },
  {
    id: 12, name: 'Lillys Poster', cat: 'accessories', catLabel: 'Accessories',
    tag: 'new', fill: '#14120f', bg: '#b6a6ff',
    sizes: ['21×30 cm', '30×40 cm', 'A2 (42×59.4 cm)', '50×70 cm', 'A1 (59.4×84.1 cm)', '70×100 cm'],
    sizePricing: {
      '21×30 cm': 14.00,
      '30×40 cm': 18.50,
      'A2 (42×59.4 cm)': 19.50,
      '50×70 cm': 23.50,
      'A1 (59.4×84.1 cm)': 27.00,
      '70×100 cm': 32.00,
    },
    image: 'https://files.cdn.printful.com/files/e56/e56f2cb4e47f3f681cbef9ed2a431c8a_preview.png',
    description: "Matte enhanced-paper print of the Lillys artwork. Ships rolled in a protective tube. Pick your size below — bigger prints cost more to produce, so pricing scales with size."
  },
];

const CART_KEY = 'lalilly_cart';

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

function addToCart(id, qty, btn, size) {
  qty = qty || 1;
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) return;
  const existing = cart.find(c => c.id === id && c.size === size);
  if (existing) existing.qty += qty;
  else cart.push({ id: product.id, qty, size: size || undefined });
  saveCart(cart);
  updateCartUI();
  if (btn) {
    const original = btn.textContent;
    btn.textContent = 'Added';
    btn.classList.add('added');
    setTimeout(() => { btn.textContent = original; btn.classList.remove('added'); }, 900);
  }
}

function removeFromCart(id, size) {
  cart = cart.filter(c => !(c.id === id && c.size === size));
  saveCart(cart);
  updateCartUI();
}

function cartLinesWithProducts() {
  return cart
    .map(c => {
      const product = PRODUCTS.find(p => p.id === c.id);
      return product ? { ...product, qty: c.qty, size: c.size } : null;
    })
    .filter(Boolean);
}

// Returns the unit price for a product, accounting for size-based pricing
// (like the poster, where a bigger print costs more) — falls back to the
// product's flat price for everything else.
function getUnitPrice(product, size) {
  if (product.sizePricing) {
    return size ? product.sizePricing[size] : null;
  }
  return product.price;
}

// For the shop grid / related-products cards, where no size is chosen yet:
// shows the flat price, or "From $X" (the cheapest size) for variable-price
// products like the poster.
function getDisplayPrice(product) {
  if (product.sizePricing) {
    const min = Math.min(...Object.values(product.sizePricing));
    return `From $${min.toFixed(2)}`;
  }
  return `$${product.price.toFixed(2)}`;
}

const FREE_SHIPPING_THRESHOLD = 50;
const STANDARD_SHIPPING = 4.99;

function updateCartUI() {
  const lines = cartLinesWithProducts();
  const count = lines.reduce((sum, c) => sum + c.qty, 0);
  const subtotal = lines.reduce((sum, c) => sum + c.qty * getUnitPrice(c, c.size), 0);
  const shipping = subtotal === 0 ? 0 : (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING);
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
  itemsEl.innerHTML = lines.map(c => `
    <div class="cart-line">
      <div class="cart-line-art" style="background:${c.bg}">${productMedia(c)}</div>
      <div class="cart-line-info">
        <h5>${c.name}${c.size ? ` — ${c.size}` : ''}</h5>
        <span>Qty ${c.qty} · $${(c.qty * getUnitPrice(c, c.size)).toFixed(2)}</span>
      </div>
      <button class="cart-remove" onclick="removeFromCart(${c.id}, ${c.size ? `'${c.size}'` : 'undefined'})">Remove</button>
    </div>
  `).join('');
}

function toggleCart(open) {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('overlay');
  if (drawer) drawer.classList.toggle('open', open);
  if (overlay) overlay.classList.toggle('open', open);
}

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
        cart: cart.map(c => ({ id: c.id, qty: c.qty, size: c.size })),
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

function handleSignup(e) {
  e.preventDefault();
  const note = document.getElementById('signupNote');
  const emailInput = document.getElementById('emailInput');
  note.textContent = "You're on the list: " + emailInput.value;
  emailInput.value = '';
  // Placeholder — connect to Mailchimp, Klaviyo, or similar for real signups.
}

// Update the cart badge as soon as the page loads, on every page that includes this file.
document.addEventListener('DOMContentLoaded', updateCartUI);
