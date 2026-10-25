# Encrypted WooCommerce backups and recovery

The production VM runs `lalilly-backup.timer` daily at 04:15 UTC, with up to five minutes of jitter. It retains the newest 14 encrypted snapshots under `/opt/lalilly/backups`, outside the WordPress volume. `lalilly-backup.service` completed successfully during setup. Python 3 and the Ubuntu `python3-cryptography` package are required.

Each snapshot contains a transaction-consistent MariaDB SQL dump, the WordPress files, deployment configuration, the bridge plugin, and protected integration/owner credential backups. The database and files are encrypted on the VM before transfer. A public recovery key lives at `/opt/lalilly/backup-tools/recovery-public.pem`; the matching private key stays in a restricted folder on the owner's PC. The private key is never included in the snapshot or uploaded to the VM. Keep a secure second copy of the recovery key: losing it makes encrypted backups unrecoverable.

On October 25, 2026, a 51,242,720-byte encrypted snapshot was copied off the VM. Its SHA-256 is `05bf75b6b8332226ae1c5cc90822a48cec0448fee5380ba1886a8610b136ea45`. The copied archive was decrypted in memory on the PC, a tampered copy was rejected, and the authenticated archive was streamed over SSH to the restore test. No plaintext Woo credential file was written on the PC.

The isolated restore recovered the actual WordPress files and SQL into a temporary MariaDB container on an internal-only Docker network with no published ports. WordPress loaded the restored database, WooCommerce and bridge. It verified product 11's name, $27.92 price, ten variations, and cancelled test order 26. External HTTP and paid release were disabled. The temporary containers, network and decrypted restore files were removed; the live store was not changed.

The server's daily snapshots are not automatically copied off the VM. The first off-VM copy is verified; arrange regular copies to an owner-controlled device or existing backup destination before relying on unattended recovery. Never store decrypted snapshots or recovery keys in this repository, a public Pages output directory, or shared source archives.

## Commands

On the VM, through the existing protected SSH administration connection:

```sh
sudo systemctl status lalilly-backup.timer
sudo systemctl start lalilly-backup.service
sudo journalctl -u lalilly-backup.service -n 10 --no-pager
```

The setup workspace includes `work/backup-recovery.mjs` and the restricted `work/private-backups/` folder. The former records the tested initial snapshot and supports `pull` and `test`; do not rerun `pull` against an existing destination file. It is an operational recovery helper, not deployed website code. Only the encrypted archive and public key may be moved to ordinary storage; preserve the private key separately with restricted access.

`deploy/woocommerce/restore-test.py` accepts the already authenticated `.tar.gz` bytes on stdin and runs only a guarded temporary restore test on the VM. It is not a command for overwriting the live database. Do not run it against a public web request or expose it as a web endpoint.

## Snapshot format

The file begins with eight bytes `LLBACK1\n`, a four-byte big-endian JSON header length, the JSON header, ciphertext, and a final 16-byte GCM tag. The header specifies version 1, AES-256-GCM, RSA-OAEP-SHA256, a base64 12-byte nonce and base64 wrapped random 32-byte content key. Each snapshot uses a fresh content key and nonce. The exact prefix and header bytes are authenticated as GCM additional data. Authenticate the complete ciphertext before extracting any archive data or importing SQL. SHA-256 checks inside the encrypted archive additionally verify the SQL and bridge file.

## Full recovery after VM loss

Provision an equivalent protected Docker host, recover the encrypted snapshot and separately held recovery key, authenticate/decrypt it, then restore its database, WordPress files and deployment configuration into new volumes. Start with `LALILLY_ALLOW_PAID_ORDERS=false` and supplier submission held. Preserve order IDs, order keys, API grants, webhook secrets and import metadata; they prevent duplicate fulfillment after retries. Restore matching Cloudflare order/snapshot KV data if that service was also lost. API credentials and private keys must remain server-side. Validate REST authentication and order reconciliation before changing DNS or accepting new orders. A backup of this VM does not include Cloudflare KV or Stripe's data.
