// ---- Shared product catalog, icon renderer, and cart logic ----
// Used by both index.html and product.html so they never drift out of sync.
// Cart is persisted to localStorage so it survives navigating between pages.

function pugIcon(fill, bg) {
  return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="${bg}"/>
    <path d="M50 22c-15 0-24 11-24 26 0 5 2 10 5 14-3 2-5 5-5 8 0 6 5 11 12 11h24c7 0 12-5 12-11 0-3-2-6-5-8 3-4 5-9 5-14 0-15-9-26-24-26z" fill="${fill}"/>
    <ellipse cx="39" cy="52" rx="3.5" ry="4.5" fill="${bg}"/>
    <ellipse cx="61" cy="52" rx="3.5" ry="4.5" fill="${bg}"/>
    <path d="M43 64c2 3.5 12 3.5 14 0" stroke="${bg}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M27 36c-5-4-9-12-6-18 5 2 10 9 11 14M73 36c5-4 9-12 6-18-5 2-10 9-11 14" stroke="${fill}" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`;
}

const PRODUCTS = [
  {
    id: 1, name: 'L Snapback Hat', cat: 'headwear', catLabel: 'Headwear',
    price: 26.00, tag: 'low', fill: '#14120f', bg: '#c8ff4d',
    description: "The one hat that's on every regular's head at the drop. Structured 6-panel snapback with an embroidered L, flat brim, adjustable snap closure. Runs true to size."
  },
  {
    id: 2, name: 'Lilly Pug Pillow Plush', cat: 'accessories', catLabel: 'Accessories',
    price: 18.50, tag: null, fill: '#f7f3ec', bg: '#ff2f7e',
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
    description: "Heavyweight cotton tee with the FreakYe graphic front and center. Boxy fit, garment-dyed for a worn-in feel right out of the bag."
  },
  {
    id: 6, name: 'I ♥ Lilly Pug T-Shirt', cat: 'apparel', catLabel: 'Apparel',
    price: 22.50, tag: null, fill: '#ff2f7e', bg: '#f7f3ec',
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

const FREE_SHIPPING_THRESHOLD = 40;
const STANDARD_SHIPPING = 4.99;

function updateCartUI() {
  const lines = cartLinesWithProducts();
  const count = lines.reduce((sum, c) => sum + c.qty, 0);
  const subtotal = lines.reduce((sum, c) => sum + c.qty * c.price, 0);
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
      <div class="cart-line-art" style="background:${c.bg}">${pugIcon(c.fill, c.bg)}</div>
      <div class="cart-line-info">
        <h5>${c.name}${c.size ? ` — ${c.size}` : ''}</h5>
        <span>Qty ${c.qty} · $${(c.qty * c.price).toFixed(2)}</span>
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
    const res = await fetch('/.netlify/functions/create-checkout-session', {
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
