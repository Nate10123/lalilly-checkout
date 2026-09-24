// Shared helper for placing an order with Printify. Printify's order shape
// is different enough from Printful's (line items need both a product_id
// AND a variant_id, since Printify variant IDs are only unique within a
// product — unlike Printful's globally-unique sync_variant_id) that it gets
// its own small module rather than being inlined next to the Printful call.
//
// Like Printful's `confirm: false`, a Printify order created via this
// endpoint just sits as a draft — Printify only starts production once you
// separately call POST /orders/{id}/send_to_production.json. We don't call
// that here, so new orders land for review first, same as Printful.

// Printify wants first/last name as separate fields; Stripe only gives us
// one "name" string. Split on the first space and fall back gracefully if
// there isn't one, so an order never gets rejected for a missing last name.
function splitName(fullName) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: 'Customer', lastName: '' };
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) return { firstName: trimmed, lastName: trimmed };
  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1),
  };
}

// `items` is an array of { printifyProductId, variantId, quantity }.
// `recipient` matches the shape already built in stripe-webhook.js from the
// Stripe session (name, address1, address2, city, state_code, country_code,
// zip, email).
export async function placePrintifyOrder(env, { items, recipient, externalId }) {
  if (!env.PRINTIFY_API_KEY) {
    throw new Error('PRINTIFY_API_KEY is not set');
  }
  if (!env.PRINTIFY_SHOP_ID) {
    throw new Error('PRINTIFY_SHOP_ID is not set');
  }

  const { firstName, lastName } = splitName(recipient.name);

  const order = {
    external_id: externalId,
    line_items: items.map(({ printifyProductId, variantId, quantity }) => ({
      product_id: printifyProductId,
      // Printify wants this as a number, not a string.
      variant_id: Number(variantId),
      quantity,
    })),
    // 1 = the provider's standard shipping method. Printify doesn't expose
    // a simpler "just pick something reasonable" option than this.
    shipping_method: 1,
    // We handle our own shipping-confirmation email via Stripe/the Track
    // Your Order page — don't let Printify email the customer too.
    send_shipping_notification: false,
    address_to: {
      first_name: firstName,
      last_name: lastName,
      email: recipient.email,
      country: recipient.country_code,
      region: recipient.state_code || '',
      address1: recipient.address1,
      address2: recipient.address2 || '',
      city: recipient.city,
      zip: recipient.zip,
    },
  };

  const res = await fetch(
    `https://api.printify.com/v1/shops/${env.PRINTIFY_SHOP_ID}/orders.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error('Printify order failed: ' + JSON.stringify(data));
  }

  return data; // includes `id` — the Printify order id
}
