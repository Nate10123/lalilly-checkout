# Verification — La Lilly WooCommerce bridge

Updated October 24, 2026 (America/Los_Angeles).

Repository: `Nate10123/lalilly-checkout`.
Inspected original base: `004ba6a1dafd2cfdba6d7fe2f6bf94af5b675271`; updated onto `a88f08e805fc68207371fdfa5b7ac702040b84d4` on October 24, 2026, preserving the newer production image changes.
Local branch: `codex/woocommerce-tapstitch-bridge`.

This captures the verification baseline before the first frontend deployment. No paid upgrade, live payment or supplier production order was performed. WooCommerce routing remains off in wrangler.toml and existing product/provider mappings are unchanged. The free Oracle backend and store DNS/HTTPS are deployed, and Tapstitch is connected. One approved integration account authenticates successfully to the public APIs; the server paid-order gate remains false. Website API credentials and webhook secret are encrypted Cloudflare production settings. No plaintext credential file was created on the PC.

## Completed checks

| Check | Result |
| --- | --- |
| `npm test` on Node 24.19.0 | **21 tests passed** |
| Real WordPress/WooCommerce integration test, legacy order storage | **23 assertions passed** |
| Same integration test, HPOS order storage | **23 assertions passed** |
| PHP lint, bridge and integration test | Passed |
| Wrangler 4.151.3 Pages function bundle, repository compatibility date and `nodejs_compat` | Compiled successfully |
| Official standalone Docker Compose 5.6.1 `config --quiet` | Passed |
| Parsed Compose configuration checks | DB/Apache host ports private, paid-order gate false, PHP variable escaping preserved |
| `git diff --check` | Passed |
| Public HTTPS / authenticated bridge and product APIs | HTTP 200; unauthenticated bridge HTTP 401 |
| Official Tapstitch connection and product sync | Store Live; 10 variants synced; six active webhooks |
| Approved live $0 test through real JS adapter and HTTPS order import | Woo #26; all ten variations verified; duplicate import returned the same order |
| Tapstitch ingestion after test-only Processing transition | Order #1563916963716198400 On Hold; 10 distinct size/color combinations; clothing label on all ten lines |
| Test cleanup | Cancelled in both WooCommerce and Tapstitch, no payment or production |
| Local product-page browser verification | Existing styling, approved $27.92, White/XXL selection and gallery work; Coming Soon remains disabled |

The JavaScript tests use Stripe's real installed SDK for request encoding and webhook signature verification, with mocked outbound HTTP. They exercise existing checkout behavior, the Woo path, immutable mapping/price snapshots, variant identity, disabled feature behavior, mixed-cart blocking, unapproved live-checkout blocking, discounts/tax/shipping reconciliation, zero-value promotions, invalid/unpaid payment events, retryable Woo failures, a paid Printify fulfillment regression, Woo HMAC tampering, tracking privacy and static-file protection.

The PHP integration tests ran in an isolated localhost WordPress **7.1.3**, WooCommerce **11.2.1**, PHP **8.3.36**, MariaDB **11.4.9** environment downloaded into the working directory. No system-wide service was installed. External WordPress HTTP requests were blocked and email was suppressed. Synthetic products/orders were created locally and removed by the test. Both legacy and HPOS storage were tested.

The real database tests cover Woo consumer-key authentication, invalid-secret rejection, permission checks, actual product/variation/quantity records, line tax, shipping/billing separation, total/discount preservation, duplicate delivery, changed-payload rejection, interrupted import recovery, frozen review mode, production-mode status transition without invoking a payment gateway, replay/cancellation preservation, test-mode protection, wrong SKU, changed variant attributes, zero-value checkout references, and contention from a second database connection holding the import lock.

Two compatibility issues discovered during real testing were corrected: Woo truncates order keys to 22 characters, and current Woo defers bulk item removal until an order save. The final key fits that limit, and interrupted-import recovery persists deletions before rebuilding items.

## Reproduce

```sh
npm ci --ignore-scripts
npm test
php -l deploy/woocommerce/mu-plugins/lalilly-bridge.php
php -l tests/woocommerce.integration.php
npx wrangler pages functions build functions --outdir=../cloudflare-build --compatibility-date=2026-08-01 --compatibility-flag=nodejs_compat
docker compose --env-file deploy/woocommerce/.env.example -f deploy/woocommerce/compose.yaml config --quiet
```

For real database testing, use a disposable local WordPress/Woo installation with the bridge installed as a must-use plugin, `WP_HTTP_BLOCK_EXTERNAL=true`, and no Tapstitch connector. Set `LALILLY_INTEGRATION_TESTS=yes`, then run `wp eval-file tests/woocommerce.integration.php`. The test refuses a non-localhost site. Test both storage modes using Woo's HPOS CLI commands on that disposable database only. Do not run the integration script against a live or connected store.

## Still unverified / requires your accounts and infrastructure

- Certificate renewal, off-VM backups and recovery operations. Initial public DNS, firewall configuration, trusted HTTPS, Linux ARM Docker startup and real authenticated API access passed on the free Oracle VM. All four containers were running with a healthy database on October 24.
- A real Stripe test-mode checkout against the deployed website. The live backend test used explicit synthetic Stripe fixtures; SDK signature and checkout behavior are covered locally with mocked outbound HTTP.
- Website deployment and paid-checkout activation. The selected shirt is prepared locally as product 31, with all ten real mappings, the approved Lape Label and approved $27.92 retail price.
- Enabling automatic supplier submission/payment. Tapstitch is currently Manual, with no card linked, and International fulfillment selected. These settings keep the approved test unpaid; full automatic production requires the owner to configure supplier payment.
- Actual tracking metadata, partial shipments, notifications and a complete production/shipment cycle.
- End-to-end production refund/cancellation operations, which are intentionally manual in this first release.

The separate old public `Nate10123/lilly-brand-store` prototype contains a hardcoded Printful token. It is unrelated to this checkout's environment-based credentials and was not included in this patch. Revoke the old token if it remains active; removing a token from current source does not remove it from public Git history.
