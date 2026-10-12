const PRIMARY_HOST = 'lillypug.com';
const OLD_ORIGIN = 'https://lalilly-checkout.pages.dev';
const PRIMARY_ORIGIN = `https://${PRIMARY_HOST}`;

export async function onRequest(context) {
  const url = new URL(context.request.url);

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
  const html = (await response.text()).split(OLD_ORIGIN).join(PRIMARY_ORIGIN);
  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
