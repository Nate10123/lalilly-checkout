<?php
// Run ONLY in an isolated local WP/Woo database:
// LALILLY_INTEGRATION_TESTS=yes wp eval-file tests/woocommerce.integration.php
// This creates and deletes synthetic products/orders. It never calls Tapstitch or Stripe.
if (getenv('LALILLY_INTEGRATION_TESTS') !== 'yes' || !defined('WP_HTTP_BLOCK_EXTERNAL') || !WP_HTTP_BLOCK_EXTERNAL || !in_array(parse_url(home_url(), PHP_URL_HOST), array('127.0.0.1', 'localhost'), true)) {
    throw new Exception('Integration tests require an explicitly opted-in localhost WordPress database.');
}
if (!function_exists('lalilly_import_order')) throw new Exception('Install the bridge must-use plugin first.');
add_filter('pre_wp_mail', '__return_true');
function ll_assert($condition, $message) { if (!$condition) throw new Exception($message); echo "PASS: $message\n"; }
function ll_import($data) {
    $request = new WP_REST_Request('POST', '/wc/v3/lalilly-orders');
    $request->set_header('Content-Type', 'application/json');
    $request->set_body(wp_json_encode($data));
    return lalilly_import_order($request);
}
$products = array(); $orders = array(); $old_gate = getenv('LALILLY_ALLOW_PAID_ORDERS'); $key_id = null; $old_server = $_SERVER;
try {
    wp_set_current_user(0);
    $denied = rest_do_request(new WP_REST_Request('GET', '/wc/v3/lalilly-bridge'));
    ll_assert(in_array($denied->get_status(), array(401, 403), true), 'unauthenticated bridge access is denied');
    global $wpdb;
    $consumer_key = 'ck_' . bin2hex(random_bytes(20)); $consumer_secret = 'cs_' . bin2hex(random_bytes(20));
    $wpdb->insert($wpdb->prefix . 'woocommerce_api_keys', array('user_id' => 1, 'description' => 'LOCAL TEST ONLY', 'permissions' => 'read_write', 'consumer_key' => wc_api_hash($consumer_key), 'consumer_secret' => $consumer_secret, 'truncated_key' => substr($consumer_key, -7)));
    $key_id = $wpdb->insert_id;
    $_SERVER['REQUEST_URI'] = '/wp-json/wc/v3/lalilly-bridge'; $_SERVER['HTTPS'] = 'on';
    $_SERVER['PHP_AUTH_USER'] = $consumer_key; $_SERVER['PHP_AUTH_PW'] = $consumer_secret;
    $auth = new WC_REST_Authentication();
    ll_assert((int) $auth->authenticate(false) === 1, 'Woo consumer-key Basic authentication applies to bridge namespace');
    $_SERVER['PHP_AUTH_PW'] = 'wrong';
    ll_assert(!(new WC_REST_Authentication())->authenticate(false), 'invalid consumer secret is rejected');
    $_SERVER = $old_server;
    wp_set_current_user(1);
    ll_assert(rest_do_request(new WP_REST_Request('GET', '/wc/v3/lalilly-bridge'))->get_status() === 200, 'authorized bridge access succeeds');
    $parent = new WC_Product_Variable(); $parent->set_name('LOCAL TEST ONLY — La Lilly'); $parent->set_status('publish');
    $attrs = array();
    foreach (array('Color' => 'White', 'Size' => 'M') as $name => $value) {
        $attribute = new WC_Product_Attribute(); $attribute->set_name($name); $attribute->set_options(array($value));
        $attribute->set_visible(true); $attribute->set_variation(true); $attrs[] = $attribute;
    }
    $parent->set_attributes($attrs); $parent->save(); $products[] = $parent;
    $variant = new WC_Product_Variation(); $variant->set_parent_id($parent->get_id());
    $variant->set_attributes(array('color' => 'White', 'size' => 'M')); $variant->set_regular_price('27.50');
    $variant->set_sku('LOCAL-TEST-' . wp_generate_password(12, false)); $variant->set_status('publish'); $variant->save(); $products[] = $variant;
    $external = 'cs_test_local_' . bin2hex(random_bytes(12));
    $address = array('first_name' => 'Test', 'last_name' => 'Customer', 'address_1' => '1 Test St', 'address_2' => '', 'city' => 'Portland', 'state' => 'OR', 'postcode' => '97201', 'country' => 'US');
    $data = array('external_id' => $external, 'test_mode' => true, 'transaction_id' => 'pi_local_test', 'currency' => 'USD', 'release' => false,
        'lines' => array(array('productId' => $parent->get_id(), 'variationId' => $variant->get_id(), 'sku' => $variant->get_sku(), 'attributes' => array(array('name' => 'Color', 'option' => 'White'), array('name' => 'Size', 'option' => 'M')), 'quantity' => 2, 'subtotalCents' => 5500, 'totalCents' => 4500, 'taxCents' => 550)),
        'shipping' => $address, 'billing' => array_merge($address, array('email' => 'synthetic@example.com', 'phone' => '')),
        'billing_address' => array('line1' => '2 Billing St', 'city' => 'Portland', 'state' => 'OR', 'postal_code' => '97201', 'country' => 'US'),
        'shippingCents' => 499, 'shippingTaxCents' => 0, 'taxCents' => 550, 'discountCents' => 1000, 'totalCents' => 5549);
    putenv('LALILLY_ALLOW_PAID_ORDERS=false');
    $response = ll_import($data);
    ll_assert($response instanceof WP_REST_Response, 'a real WooCommerce order is created');
    $id = $response->get_data()['id']; $orders[] = $id; $order = wc_get_order($id);
    ll_assert($order->get_status() === 'on-hold' && !$order->is_paid(), 'test import remains on hold');
    ll_assert($order->get_total() === '55.49' && $order->get_total_tax() === '5.5' && $order->get_discount_total() === '10', 'order total, Stripe tax and discount persist');
    $lines = array_values($order->get_items());
    ll_assert(count($lines) === 1 && $lines[0]->get_variation_id() === $variant->get_id() && $lines[0]->get_quantity() === 2, 'correct parent/variation and quantity persist');
    ll_assert((float) $lines[0]->get_total() === 45.0 && (float) $lines[0]->get_total_tax() === 5.5, 'discounted product total and external line tax persist');
    ll_assert($order->get_billing_address_1() === '2 Billing St' && $order->get_shipping_address_1() === '1 Test St', 'billing and shipping stay distinct');
    ll_assert(ll_import($data)->get_data()['id'] === $id && count(wc_get_order($id)->get_items()) === 1, 'duplicate delivery returns the same order without duplicate items');
    $changed = $data; $changed['totalCents']++;
    ll_assert(is_wp_error(ll_import($changed)) && wc_get_order($id)->get_total() === '55.49', 'changed payload cannot mutate an existing import');
    $order = wc_get_order($id); $order->set_status('pending'); $order->update_meta_data('_lalilly_import_complete', false); $order->save();
    $recovered = ll_import($data);
    ll_assert($recovered instanceof WP_REST_Response && $recovered->get_data()['id'] === $id && count((new WC_Order($id))->get_items()) === 1, 'interrupted pending import rebuilds the same order');
    putenv('LALILLY_ALLOW_PAID_ORDERS=true'); $later_release = $data; $later_release['release'] = true;
    ll_assert(ll_import($later_release)->get_data()['id'] === $id && wc_get_order($id)->get_status() === 'on-hold', 'retry cannot release an old review order');
    $live = $data; $live['external_id'] = 'cs_live_local_' . bin2hex(random_bytes(12)); $live['test_mode'] = false; $live['release'] = true;
    $paid = ll_import($live); ll_assert($paid instanceof WP_REST_Response, 'production-mode local fixture imports');
    $paid_id = $paid->get_data()['id']; $orders[] = $paid_id;
    ll_assert(wc_get_order($paid_id)->get_status() === 'processing' && wc_get_order($paid_id)->is_paid(), 'both gates allow Woo payment-complete without a gateway charge');
    ll_assert(ll_import($live)->get_data()['id'] === $paid_id && count(wc_get_order($paid_id)->get_items()) === 1, 'paid replay returns same processing order');
    $cancelled = wc_get_order($paid_id); $cancelled->update_status('cancelled');
    ll_assert(ll_import($live)->get_data()['id'] === $paid_id && wc_get_order($paid_id)->get_status() === 'cancelled', 'replay never reopens a cancelled order');
    $test_release = $data; $test_release['external_id'] = 'cs_test_local_' . bin2hex(random_bytes(12)); $test_release['release'] = true;
    $held = ll_import($test_release); $orders[] = $held->get_data()['id'];
    ll_assert(wc_get_order(end($orders))->get_status() === 'on-hold', 'test mode overrides both release gates');
    $bad = $data; $bad['external_id'] = 'cs_test_bad_' . bin2hex(random_bytes(12)); $bad['lines'][0]['sku'] = 'WRONG';
    ll_assert(is_wp_error(ll_import($bad)), 'incorrect variant SKU is rejected before import');
    $bad_attributes = $data; $bad_attributes['external_id'] = 'cs_test_bad_' . bin2hex(random_bytes(12)); $bad_attributes['lines'][0]['attributes'][0]['option'] = 'Black';
    ll_assert(is_wp_error(ll_import($bad_attributes)), 'changed variant attributes are rejected before import');
    $zero = $data; $zero['external_id'] = 'cs_test_zero_' . bin2hex(random_bytes(12)); $zero['transaction_id'] = $zero['external_id'];
    $zero['lines'][0]['totalCents'] = 0; $zero['lines'][0]['taxCents'] = 0;
    $zero['shippingCents'] = 0; $zero['taxCents'] = 0; $zero['discountCents'] = 5500; $zero['totalCents'] = 0;
    $zero_response = ll_import($zero); $orders[] = $zero_response->get_data()['id'];
    ll_assert((float) wc_get_order(end($orders))->get_total() === 0.0, 'zero-value promotional order uses its checkout reference');
    // Hold the same named lock on another DB connection: the import must request a retry.
    $db_host = explode(':', DB_HOST);
    $db = new mysqli($db_host[0], DB_USER, DB_PASSWORD, DB_NAME, isset($db_host[1]) ? (int) $db_host[1] : 3306);
    $lock = 'lalilly_' . substr(hash('sha256', $external), 0, 40);
    $db->query("SELECT GET_LOCK('" . $db->real_escape_string($lock) . "', 0)");
    $busy = ll_import($data);
    $db->query("SELECT RELEASE_LOCK('" . $db->real_escape_string($lock) . "')"); $db->close();
    ll_assert(is_wp_error($busy) && $busy->get_error_code() === 'import_busy', 'a concurrent database lock blocks duplicate work and asks for retry');
    echo 'Integration checks passed with WordPress ' . get_bloginfo('version') . ', WooCommerce ' . WC_VERSION . ', PHP ' . PHP_VERSION . ".\n";
} finally {
    foreach ($orders as $id) { $order = wc_get_order($id); if ($order) $order->delete(true); }
    foreach (array_reverse($products) as $product) $product->delete(true);
    if ($key_id) $wpdb->delete($wpdb->prefix . 'woocommerce_api_keys', array('key_id' => $key_id));
    $_SERVER = $old_server;
    putenv('LALILLY_ALLOW_PAID_ORDERS=' . ($old_gate ?: 'false'));
}
