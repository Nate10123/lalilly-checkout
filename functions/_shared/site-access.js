const COOKIE = '__Host-lalilly_access';
const SESSION_SECONDS = 60 * 60 * 24;
const encoder = new TextEncoder();
const WEBHOOKS = new Set([
  '/api/stripe-webhook', '/api/printful-webhook',
  '/api/printify-webhook', '/api/woocommerce-webhook',
]);

function privateHeaders(extra = {}) {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  };
}

function returnPath(value) {
  return typeof value === 'string' && value.startsWith('/') &&
    !value.startsWith('//') && !/[\\\r\n]/.test(value) &&
    !value.startsWith('/_site/') ? value : '/';
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function gate(path, error = '', status = 401) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>LA LILLY — Private Access</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#f7f3ed;color:#14120f;font-family:Arial,sans-serif;padding:24px}
main{width:100%;max-width:440px;border:2px solid #14120f;padding:40px 28px;background:#f7f3ed;box-shadow:8px 8px 0 #CFC5F5}
.brand{font-size:42px;font-weight:900;letter-spacing:-2px;color:#ff4fa3;margin:0 0 36px}h1{font-size:28px;margin:0 0 12px}p{font-size:15px;line-height:1.6;margin:0 0 24px}
label{display:block;font-size:13px;font-weight:700;margin-bottom:10px}input,button{width:100%;font:inherit;border:2px solid #14120f;padding:14px;border-radius:0}input{background:#fff;color:#14120f}button{margin-top:16px;background:#14120f;color:#fff;font-weight:700;cursor:pointer}button:hover{background:#333}input:focus-visible,button:focus-visible{outline:3px solid #ff4fa3;outline-offset:3px}.error{color:#a21b32;margin-top:16px;margin-bottom:0}
</style></head><body><main><p class="brand">LA LILLY</p><h1>Something good is coming.</h1>
<p>Enter the password to take a look inside.</p><form method="post" action="/_site/unlock">
<input type="hidden" name="returnTo" value="${escapeHtml(returnPath(path))}">
<label for="password">Website password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required>
<button type="submit">ENTER</button>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
</form></main></body></html>`;
  return new Response(html, { status, headers: privateHeaders({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  }) });
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function samePassword(candidate, expected) {
  const [a, b] = await Promise.all([digest(candidate), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function signingKey(env) {
  return crypto.subtle.importKey('raw', encoder.encode(env.SITE_SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function message(expiry, host, password) {
  const version = Array.from(await digest(password), b => b.toString(16).padStart(2, '0')).join('');
  return encoder.encode(`lalilly-site-access:v1:${host}:${expiry}:${version}`);
}

async function validSession(request, env, host) {
  const cookie = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`));
  const match = cookie?.slice(COOKIE.length + 1).match(/^v1\.(\d{10})\.([a-f0-9]{64})$/);
  if (!match) return false;
  const expiry = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expiry <= now || expiry > now + SESSION_SECONDS) return false;
  const signature = Uint8Array.from(match[2].match(/../g), b => parseInt(b, 16));
  return crypto.subtle.verify('HMAC', await signingKey(env), signature, await message(expiry, host, env.SITE_PASSWORD));
}

// Returns null only when the normal storefront/API handler may run.
export async function siteAccess(context) {
  const { request, env = {} } = context;
  if (env.SITE_PASSWORD_ENABLED !== 'true') return null;
  const url = new URL(request.url);
  // Keep exact signed webhook handlers reachable; do not exempt other APIs.
  if (WEBHOOKS.has(url.pathname) && request.method === 'POST') return null;
  if (!env.SITE_PASSWORD || env.SITE_PASSWORD.length > 256 || !env.SITE_SESSION_SECRET || env.SITE_SESSION_SECRET.length < 32) {
    return new Response('The store is temporarily unavailable.', { status: 503, headers: privateHeaders() });
  }
  if (url.pathname === '/_site/unlock' && request.method === 'POST') {
    if (request.headers.get('Origin') !== url.origin) {
      return new Response('Forbidden', { status: 403, headers: privateHeaders() });
    }
    if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded') ||
        Number(request.headers.get('Content-Length') || 0) > 4096) {
      return new Response('Invalid request', { status: 400, headers: privateHeaders() });
    }
    // Bounded stream read prevents oversized bodies, including chunked requests.
    const reader = request.body?.getReader();
    let body = '', bytes = 0;
    const decoder = new TextDecoder();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) { await reader.cancel(); return new Response('Invalid request', { status: 400, headers: privateHeaders() }); }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    }
    const fields = new URLSearchParams(body);
    const password = fields.get('password') || '';
    const destination = returnPath(fields.get('returnTo'));
    if (!password || password.length > 256 || !await samePassword(password, env.SITE_PASSWORD)) {
      return gate(destination, 'That password doesn’t match. Please try again.');
    }
    const expiry = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const signature = await crypto.subtle.sign('HMAC', await signingKey(env), await message(expiry, url.host, env.SITE_PASSWORD));
    const token = `v1.${expiry}.${Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('')}`;
    return new Response(null, { status: 303, headers: privateHeaders({
      Location: destination,
      'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; Secure; HttpOnly; SameSite=Lax`,
    }) });
  }
  if (await validSession(request, env, url.host)) return null;
  if (url.pathname.startsWith('/api/')) {
    return Response.json({ error: 'Website password required.' }, { status: 401, headers: privateHeaders() });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Website password required.', { status: 401, headers: privateHeaders() });
  }
  const response = gate(url.pathname + url.search);
  return request.method === 'HEAD' ? new Response(null, response) : response;
}

export function protectResponse(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(privateHeaders())) headers.set(name, value);
  headers.append('Vary', 'Cookie');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
