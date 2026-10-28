# Website password protection

Only the custom storefront at lillypug.com is gated. The WooCommerce backend
store.lillypug.com and its Tapstitch connection are unchanged.

## Owner on/off setting

Open Cloudflare → Workers & Pages → lalilly-checkout → Settings → Production →
Variables and secrets. Edit the encrypted `SITE_PASSWORD_ENABLED` setting:

- `true`: require the website password.
- `false`: open the website to everyone.

Save, then go to Deployments → the latest production deployment → Retry deployment.
The setting takes effect when that new deployment succeeds, usually within a few
minutes. No code change or paid plan is needed. Keep the password and signing
secret in place when turning the gate off, so turning it on again is one setting.

This flag is deliberately absent from wrangler.toml so it stays editable in the
dashboard (as a Secret, since this project's text variables are managed by Wrangler).
Missing/false means public. True with missing credentials fails closed
with 503, rather than exposing the storefront.

`SITE_PASSWORD` and `SITE_SESSION_SECRET` must both be encrypted Secrets.
The session secret must be a random value of at least 32 characters. Use a strong,
unique visitor password; share it only with people who may view the store.
Changing either secret and redeploying invalidates all existing access cookies.
Cookies expire after 24 hours and are Secure, HttpOnly, host-only and SameSite=Lax.
The password never appears in source, browser JavaScript, URLs, or cookies.

Only exact POST routes for stripe-webhook, printful-webhook, printify-webhook and
woocommerce-webhook bypass the gate. Their existing signature validation remains
mandatory. Checkout, order status, newsletter and direct asset URLs require a valid
access cookie. Requests and authenticated responses use private/no-store headers.
Cloudflare Pages must use **Fail closed** in Settings → Runtime so exhausted
Functions quotas cannot fall back to serving unprotected static content.

The gate is for temporarily restricting the hosted storefront. This repository
remains public, so product content and image files already committed to GitHub
are still public there. Previously downloaded browser content cannot be revoked.

Run `npm test` before deployment, then check a fresh visitor, an incorrect password,
correct password, a deep product link, direct assets and rejected unsigned webhook.
Turning protection on/off affects website access only; it does not change any
WooCommerce paid-order or Tapstitch production flags.
