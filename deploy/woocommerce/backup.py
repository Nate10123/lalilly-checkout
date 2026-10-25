#!/usr/bin/env python3
"""Root-only SQL/files backup; RSA-OAEP-SHA256 wraps a fresh AES-256-GCM key.

Only the public recovery key belongs on this server. Never put the private key,
decrypted backups, credentials, or the server .env in Git or the static output.
"""
import argparse
import base64
import hashlib
import json
import os
import pathlib
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC = b'LLBACK1\n'

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default='/opt/lalilly/woocommerce')
    parser.add_argument('--output', default='/opt/lalilly/backups')
    parser.add_argument('--public-key', default='/opt/lalilly/backup-tools/recovery-public.pem')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run as root; the backup contains protected server configuration.')
    os.umask(0o077)
    source = pathlib.Path(args.source).resolve(strict=True)
    output = pathlib.Path(args.output)
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    public = serialization.load_pem_public_key(pathlib.Path(args.public_key).read_bytes())
    if public.key_size < 3072:
        raise ValueError('Recovery RSA key must be at least 3072 bits.')
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destination = output / ('lalilly-' + timestamp + '.llbak')
    with tempfile.TemporaryDirectory(prefix='lalilly-backup-', dir='/opt/lalilly') as temporary:
        temporary = pathlib.Path(temporary)
        database = temporary / 'database.sql'
        with database.open('wb') as handle:
            run(['docker', 'compose', 'exec', '-T', 'database', 'sh', '-c',
                 'export MYSQL_PWD="$MARIADB_ROOT_PASSWORD"; exec mariadb-dump -uroot --single-transaction --quick --routines --events --triggers wordpress'], cwd=source, stdout=handle)
        if database.stat().st_size < 1024:
            raise ValueError('Database dump is unexpectedly small.')
        mountpoint = run(['docker', 'volume', 'inspect', 'lalilly-woocommerce_wordpress', '--format', '{{.Mountpoint}}'], capture_output=True, text=True).stdout.strip()
        wordpress = pathlib.Path(mountpoint).resolve(strict=True)
        if not (wordpress / 'wp-config.php').is_file():
            raise ValueError('Unexpected WordPress volume.')
        manifest = {'version': 1, 'createdUtc': timestamp, 'databaseSha256': hashlib.sha256(database.read_bytes()).hexdigest(),
                    'bridgeSha256': hashlib.sha256((source / 'mu-plugins/lalilly-bridge.php').read_bytes()).hexdigest(),
                    'sourceDomain': 'store.lillypug.com', 'privateKeyIncluded': False}
        (temporary / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        archive = temporary / 'snapshot.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            tar.add(database, arcname='database.sql')
            tar.add(temporary / 'manifest.json', arcname='manifest.json')
            tar.add(wordpress, arcname='wordpress')
            for relative in ('compose.yaml', 'Caddyfile', '.env', 'mu-plugins'):
                tar.add(source / relative, arcname='deployment/' + relative)
            for relative in ('bridge-credentials.json', 'wordpress-owner.json'):
                tar.add(source.parent / relative, arcname='protected/' + relative)
        key, nonce = os.urandom(32), os.urandom(12)
        wrapped = public.encrypt(key, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
        header = json.dumps({'version':1,'cipher':'AES-256-GCM','wrap':'RSA-OAEP-SHA256','nonce':base64.b64encode(nonce).decode(),
                             'wrappedKey':base64.b64encode(wrapped).decode(),'createdUtc':timestamp}, separators=(',',':'), sort_keys=True).encode()
        prefix = MAGIC + len(header).to_bytes(4, 'big') + header
        encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
        encryptor.authenticate_additional_data(prefix)
        partial = destination.with_suffix('.partial')
        try:
            with archive.open('rb') as source_file, partial.open('xb') as encrypted:
                encrypted.write(prefix)
                for chunk in iter(lambda: source_file.read(1024 * 1024), b''):
                    encrypted.write(encryptor.update(chunk))
                encrypted.write(encryptor.finalize())
                encrypted.write(encryptor.tag)
                encrypted.flush()
                os.fsync(encrypted.fileno())
            partial.rename(destination)
        finally:
            partial.unlink(missing_ok=True)
    digest = hashlib.sha256()
    with destination.open('rb') as encrypted:
        for chunk in iter(lambda: encrypted.read(1024 * 1024), b''):
            digest.update(chunk)
    # Retain the newest 14 snapshots; only this tool's encrypted regular files.
    snapshots = sorted(path for path in output.glob('lalilly-*.llbak') if path.is_file() and not path.is_symlink())
    for expired in snapshots[:-14]:
        expired.unlink()
    print(json.dumps({'file': str(destination), 'bytes': destination.stat().st_size, 'sha256': digest.hexdigest(), 'encrypted': True, 'retention': 14}))

if __name__ == '__main__':
    main()
