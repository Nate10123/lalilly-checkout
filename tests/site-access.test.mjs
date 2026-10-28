import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { siteAccess } from '../functions/_shared/site-access.js';
import { onRequest as middleware } from '../functions/_middleware.js';

const env = { SITE_PASSWORD_ENABLED: 'true', SITE_PASSWORD: 'test-only-visitor-password', SITE_SESSION_SECRET: 'test-only-signing-secret-at-least-32-characters' };
const origin = 'https://lillypug.com';
const context = (path = '/', options = {}, settings = env) => ({
  request: new Request(origin + path, options), env: settings,
  next: async () => new Response('<script src="store.js"></script><p>private catalog</p>', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' } }),
});
async function unlock(password = env.SITE_PASSWORD, returnTo = '/product?id=31', extra = {}) {
  return siteAccess(context('/_site/unlock', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded', ...extra }, body: new URLSearchParams({ password, returnTo }) }));
}

test('gate defaults off and can be switched off without removing secrets', async () => {
  for (const settings of [{}, { ...env, SITE_PASSWORD_ENABLED: 'false' }]) {
    assert.equal(await siteAccess(context('/', {}, settings)), null);
    assert.match(await (await middleware(context('/', {}, settings))).text(), /private catalog/);
  }
});

test('pages, deep links, assets, catalog scripts and APIs are protected server-side', async () => {
  const routes = JSON.parse(readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'));
  assert.deepEqual(routes.include, ['/*']);
  assert.deepEqual(routes.exclude, []);
  for (const path of ['/', '/shop', '/product?id=31', '/assets/products/test.png', '/store.js', '/product-extra.js', '/api/order-status', '/api/create-checkout-session', '/api/newsletter-signup']) {
    const response = await middleware(context(path));
    assert.equal(response.status, 401, path);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    const body = await response.text();
    assert.doesNotMatch(body, /private catalog|test-only/);
    assert.match(body, /password/i);
  }
  const head = await middleware(context('/shop', { method: 'HEAD' }));
  assert.equal(head.status, 401);
  assert.equal(await head.text(), '');
});

test('missing credentials fail closed only while enabled', async () => {
  for (const settings of [{ SITE_PASSWORD_ENABLED: 'true' }, { ...env, SITE_SESSION_SECRET: 'short' }]) {
    assert.equal((await middleware(context('/', {}, settings))).status, 503);
  }
});

test('correct password returns secure signed cookie and original deep link', async () => {
  const login = await unlock();
  assert.equal(login.status, 303);
  assert.equal(login.headers.get('Location'), '/product?id=31');
  const cookie = login.headers.get('Set-Cookie');
  assert.match(cookie, /^__Host-lalilly_access=v1\./);
  for (const attr of ['Path=/', 'Max-Age=86400', 'Secure', 'HttpOnly', 'SameSite=Lax']) assert.ok(cookie.includes(attr));
  assert.doesNotMatch(cookie, /test-only/);
  const response = await middleware(context('/shop', { headers: { Cookie: cookie.split(';')[0] } }));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /private catalog/);
  assert.match(response.headers.get('Cache-Control'), /private, no-store/);
  assert.match(response.headers.get('Vary'), /Cookie/);
});

test('wrong password, forged/expired cookies and changed secrets cannot unlock', async () => {
  assert.equal((await unlock('wrong')).status, 401);
  const cookie = (await unlock()).headers.get('Set-Cookie').split(';')[0];
  for (const [value, settings] of [
    [cookie.replace(/.$/, c => c === '0' ? '1' : '0'), env],
    [cookie.replace(/v1\.\d+/, 'v1.1000000000'), env],
    [cookie, { ...env, SITE_PASSWORD: 'new-test-password' }],
    [cookie, { ...env, SITE_SESSION_SECRET: 'new-test-only-signing-secret-at-least-32' }],
  ]) assert.equal((await siteAccess(context('/', { headers: { Cookie: value } }, settings))).status, 401);
});

test('login rejects cross-origin, oversized bodies and open redirects', async () => {
  assert.equal((await unlock(env.SITE_PASSWORD, '/', { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await unlock('x'.repeat(5000))).status, 400);
  for (const path of ['//evil.example', '/\\evil.example', 'https://evil.example', '/_site/unlock', '/\r\nLocation: evil']) {
    assert.equal((await unlock(env.SITE_PASSWORD, path)).headers.get('Location'), '/');
  }
  const escaped = await siteAccess(context('/?x=%22%3E%3Cscript%3E'));
  assert.doesNotMatch(await escaped.text(), /<script>/);
});

test('only exact POST webhook paths bypass access gate, leaving signature validation to handlers', async () => {
  for (const route of ['stripe', 'printful', 'printify', 'woocommerce']) {
    const path = `/api/${route}-webhook`;
    assert.equal(await siteAccess(context(path, { method: 'POST' })), null);
    assert.equal((await siteAccess(context(path))).status, 401);
    assert.equal((await siteAccess(context(path + '/extra', { method: 'POST' }))).status, 401);
  }
  assert.equal((await middleware(context('/docs/site-password.md'))).status, 404);
});
