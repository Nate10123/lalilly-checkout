const PRIMARY_HOST = 'lillypug.com';
const OLD_ORIGIN = 'https://lalilly-checkout.pages.dev';
const PRIMARY_ORIGIN = `https://${PRIMARY_HOST}`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const staging = context.env?.LALILLY_TEST_STAGE === 'true';
  if (staging && (context.env.LALILLY_STAGE_RUN !== 'true' || !/^sk_test_/.test(context.env.STRIPE_SECRET_KEY || '') || context.env.WOOCOMMERCE_ALLOW_LIVE_CHECKOUT !== 'false' || context.env.WOOCOMMERCE_ORDER_MODE !== 'review')) {
    return new Response('Test checkout is disabled or needs test-only configuration.', {status: 503, headers: {'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow'}});
  }
  // The Pages static output is the repository root. Keep server deployment material private.
  if (/^\/(deploy|docs|tests|scripts)(\/|$)/.test(url.pathname) || /^\/\.(env|dev\.vars)(\.|$)/.test(url.pathname)) {
    return new Response('Not found', { status: 404 });
  }

  // Keep a single, permanent public origin so Google does not split ranking
  // signals between the Cloudflare Pages subdomain and lillypug.com.
  if (url.hostname.endsWith('.pages.dev') && !staging) {
    const destination = new URL(url.pathname + url.search, PRIMARY_ORIGIN);
    return Response.redirect(destination.toString(), 301);
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  // Older static templates still contain the Pages origin in canonical,
  // Open Graph and JSON-LD URLs. Rewrite those signals at the edge while
  // preserving the rest of the response exactly as served.
  let html = (await response.text()).split(OLD_ORIGIN).join(PRIMARY_ORIGIN);

  // New launches can live in product-extra.js without rewriting the large
  // legacy store.js catalog. Inject it immediately after store.js, before
  // each page's inline renderer runs and reads PRODUCTS.
  const storeScript = '<script src="store.js"></script>';
  if (html.includes(storeScript) && !html.includes('product-extra.js')) {
    html = html.replace(storeScript, `${storeScript}\n<script src="product-extra.js?v=20261025-xyz-camo"></script>`);
  }

  if (staging) {
    html = html.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">');
    html = html.replace('<body>', '<body><div role="note" style="padding:12px;background:#ffe46b;color:#111;text-align:center;font-weight:bold">TEST STORE — no real payments or production.</div>');
  }
  const headers = new Headers(response.headers);
  if (staging) headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.delete('content-length');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
