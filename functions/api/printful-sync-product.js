export async function onRequestGet(context) {
  const { env } = context;
  const headers = { Authorization: `Bearer ${env.PRINTFUL_API_KEY}` };
  if (env.PRINTFUL_STORE_ID) headers['X-PF-Store-Id'] = env.PRINTFUL_STORE_ID;

  const res = await fetch('https://api.printful.com/store/products/480678224', { headers });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
