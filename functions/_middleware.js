const PRIMARY_HOST = 'lillypug.com';
const OLD_ORIGIN = 'https://lalilly-checkout.pages.dev';
const PRIMARY_ORIGIN = `https://${PRIMARY_HOST}`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  // The Pages static output is the repository root. Keep server deployment material private.
  if (/^\/(deploy|docs|tests|scripts)(\/|$)/.test(url.pathname) || /^\/\.(env|dev\.vars)(\.|$)/.test(url.pathname)) {
    return new Response('Not found', { status: 404 });
  }

  // Keep a single, permanent public origin so Google does not split ranking
  // signals between the Cloudflare Pages subdomain and lillypug.com.
  if (url.hostname.endsWith('.pages.dev')) {
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
    html = html.replace(storeScript, `<script src="store.js?v=20261027-keychain-add"></script>\n<script src="product-extra.js?v=20261027-sage-bg"></script>`);
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
