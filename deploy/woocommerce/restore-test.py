"""Read a verified archive from SSH stdin; restore only into a temporary DB.

The private recovery key stays on the PC. Containers have no published
ports and use an internal-only network. No live orders or production volumes
are modified. This is a restore TEST, never the live disaster-recovery command.
"""
import hashlib, json, os, pathlib, secrets, shutil, subprocess, sys, tarfile, tempfile, time

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

os.umask(0o077)
name = 'lalilly-restore-' + secrets.token_hex(6)
network = name + '-net'
scratch = pathlib.Path(tempfile.mkdtemp(prefix=name + '-', dir='/run'))
created_network = False
created_container = False
try:
    archive = scratch / 'snapshot.tar.gz'
    total = 0
    with archive.open('wb') as target:
        for chunk in iter(lambda: sys.stdin.buffer.read(1024 * 1024), b''):
            total += len(chunk)
            assert total <= 512 * 1024 * 1024, 'Restore test archive exceeds its limit'
            target.write(chunk)
    assert total > 1024
    with tarfile.open(archive, 'r:gz') as tar:
        tar.extractall(scratch, filter='data')
    manifest = json.loads((scratch / 'manifest.json').read_text())
    assert hashlib.sha256((scratch / 'database.sql').read_bytes()).hexdigest() == manifest['databaseSha256']
    assert hashlib.sha256((scratch / 'deployment/mu-plugins/lalilly-bridge.php').read_bytes()).hexdigest() == manifest['bridgeSha256']
    run(['docker','network','create','--internal',network], stdout=subprocess.DEVNULL)
    created_network = True
    password = secrets.token_hex(32)
    env = {**os.environ, 'MARIADB_ROOT_PASSWORD': password, 'MARIADB_DATABASE':'wordpress', 'MARIADB_USER':'wordpress', 'MARIADB_PASSWORD': password}
    run(['docker','run','-d','--name',name,'--network',network,'--network-alias','restore-db','--tmpfs','/var/lib/mysql:rw,size=768m',
         '-e','MARIADB_ROOT_PASSWORD','-e','MARIADB_DATABASE','-e','MARIADB_USER','-e','MARIADB_PASSWORD','mariadb:11.4'], env=env, stdout=subprocess.DEVNULL)
    created_container = True
    for attempt in range(90):
        ready = subprocess.run(['docker','exec',name,'healthcheck.sh','--connect','--innodb_initialized'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if ready:
            break
        time.sleep(1)
    assert ready, 'Isolated database did not start'
    with (scratch / 'database.sql').open('rb') as dump:
        run(['docker','exec','-i',name,'sh','-c','export MYSQL_PWD="$MARIADB_ROOT_PASSWORD"; exec mariadb -uroot wordpress'], stdin=dump, stdout=subprocess.DEVNULL)
    # Use the restored WordPress configuration, files, database, and bridge.
    # No cron, public ports, email transitions, or external network are allowed.
    config = "define('WP_HOME','https://restore.invalid'); define('WP_SITEURL','https://restore.invalid'); define('DISABLE_WP_CRON',true); define('WP_HTTP_BLOCK_EXTERNAL',true);"
    wp_env = {**os.environ, 'WORDPRESS_DB_HOST':'restore-db:3306','WORDPRESS_DB_NAME':'wordpress','WORDPRESS_DB_USER':'wordpress','WORDPRESS_DB_PASSWORD':password,
              'WORDPRESS_CONFIG_EXTRA':config,'LALILLY_ALLOW_PAID_ORDERS':'false','STORE_DOMAIN':'restore.invalid'}
    php = "$p=wc_get_product(11); $o=wc_get_order(26); if (!$p || !$o) throw new Exception('Restored objects missing'); echo wp_json_encode(array('productId'=>$p->get_id(),'name'=>$p->get_name(),'price'=>$p->get_price(),'variationCount'=>count($p->get_children()),'testOrderStatus'=>$o->get_status(),'bridgePresent'=>function_exists('lalilly_import_order'),'externalHttpBlocked'=>WP_HTTP_BLOCK_EXTERNAL,'paidOrdersEnabled'=>getenv('LALILLY_ALLOW_PAID_ORDERS')==='true'));"
    command = ['docker','run','--rm','--user','0:0','--network',network,'--mount',f'type=bind,src={scratch / "wordpress"},dst=/var/www/html,readonly',
               '--mount',f'type=bind,src={scratch / "deployment/mu-plugins"},dst=/var/www/html/wp-content/mu-plugins,readonly']
    for variable in ('WORDPRESS_DB_HOST','WORDPRESS_DB_NAME','WORDPRESS_DB_USER','WORDPRESS_DB_PASSWORD','WORDPRESS_CONFIG_EXTRA','LALILLY_ALLOW_PAID_ORDERS','STORE_DOMAIN'):
        command += ['-e',variable]
    command += ['wordpress:cli-php8.3','wp','--allow-root','--skip-themes','eval',php]
    result = run(command, env=wp_env, capture_output=True, text=True)
    data = json.loads(result.stdout)
    assert data['name'] == 'XYZ Camo Big Pug Head Tee' and data['price'] == '27.92' and data['variationCount'] == 10
    assert data['testOrderStatus'] == 'cancelled' and data['bridgePresent'] and data['externalHttpBlocked'] and not data['paidOrdersEnabled']
    print(json.dumps({'restoreTestPassed':True,'isolatedNetwork':True,'liveStoreModified':False,**data}))
finally:
    if created_container:
        subprocess.run(['docker','rm','-f',name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if created_network:
        subprocess.run(['docker','network','rm',network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    assert scratch.parent == pathlib.Path('/run') and scratch.name.startswith(name + '-')
    shutil.rmtree(scratch)
