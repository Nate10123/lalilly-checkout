<?php
/**
 * Plugin Name: La Lilly Order Bridge
 * Description: Authenticated, idempotent Stripe-to-WooCommerce imports. No payment is charged here.
 * Version: 1.0.0
 */
defined('ABSPATH') || exit;

add_action('before_woocommerce_init', function () {
    if (class_exists('Automattic\\WooCommerce\\Utilities\\FeaturesUtil')) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});

add_action('rest_api_init', function () {
    // Use wc/v3 so WooCommerce's existing consumer-key authentication handles these routes.
    $permission = function () { return current_user_can('manage_woocommerce'); };
    register_rest_route('wc/v3', '/lalilly-bridge', array(
        'methods' => 'GET', 'permission_callback' => $permission,
        'callback' => function () { return array('version' => 1, 'paid_orders_enabled' => getenv('LALILLY_ALLOW_PAID_ORDERS') === 'true'); },
    ));
    register_rest_route('wc/v3', '/lalilly-orders', array(
        'methods' => 'POST', 'permission_callback' => $permission, 'callback' => 'lalilly_import_order',
    ));
});

function lalilly_cents($value) {
    if (!is_int($value) || $value < 0) throw new Exception('Invalid amount.');
    return number_format($value / 100, 2, '.', '');
}

function lalilly_import_order($request) {
    global $wpdb;
    if (!class_exists('WC_Order')) return new WP_Error('woocommerce_missing', 'WooCommerce is required.', array('status' => 503));
    $data = $request->get_json_params();
    $external = isset($data['external_id']) ? $data['external_id'] : '';
    if (!is_string($external) || !preg_match('/^cs_(test_|live_)?[A-Za-z0-9_]{8,240}$/', $external)) {
        return new WP_Error('invalid_session', 'Invalid Stripe reference.', array('status' => 400));
    }
    // MySQL/MariaDB named locks serialize concurrent webhook deliveries across PHP workers.
    // A deterministic Woo order key recovers an order even if the previous HTTP response was lost.
    $lock = 'lalilly_' . substr(hash('sha256', $external), 0, 40);
    if ((string) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 10)', $lock)) !== '1') {
        return new WP_Error('import_busy', 'Retry this import.', array('status' => 503));
    }
    try {
        // Woo truncates order keys to 22 characters. Keep 114 hash bits within that limit.
        $key = 'wc_' . substr(strtr(base64_encode(hash('sha256', $external, true)), '+/', '-_'), 0, 19);
        $order_id = wc_get_order_id_by_order_key($key);
        $order = $order_id ? wc_get_order($order_id) : null;
        // Release mode is frozen on first import, so a later retry cannot release a review order.
        $content = $data;
        unset($content['release']);
        $fingerprint = hash('sha256', wp_json_encode($content));
        if ($order && $order->get_meta('_lalilly_payload_hash') !== $fingerprint) throw new Exception('Order payload changed; manual review required.');
        if (!$order || !$order->get_meta('_lalilly_import_complete')) {
            if ($data['currency'] !== 'USD' || !is_array($data['lines']) || !count($data['lines']) || count($data['lines']) > 20 || !is_bool($data['test_mode'])) throw new Exception('Invalid order.');
            if (!is_string($data['transaction_id']) || !preg_match('/^(pi_|cs_)[A-Za-z0-9_]+$/', $data['transaction_id'])) throw new Exception('Invalid payment reference.');
            $line_total = 0; $line_tax = 0; $discount = 0; $products = array();
            foreach ($data['lines'] as $line) {
                if (!is_int($line['quantity']) || $line['quantity'] < 1 || $line['quantity'] > 50) throw new Exception('Invalid quantity.');
                foreach (array('subtotalCents', 'totalCents', 'taxCents') as $field) lalilly_cents($line[$field]);
                if ($line['totalCents'] > $line['subtotalCents']) throw new Exception('Invalid discount.');
                $product = wc_get_product($line['variationId'] ?: $line['productId']);
                $parent = wc_get_product($line['productId']);
                if (!$parent || $parent->get_status() !== 'publish' || !$product || $product->get_sku() !== $line['sku'] ||
                    ($line['variationId'] && (!$product->is_type('variation') || $product->get_parent_id() !== $line['productId'])) ||
                    (!$line['variationId'] && !$product->is_type('simple'))) throw new Exception('Product/variant identity changed.');
                if ($line['variationId']) {
                    $actual_attributes = array();
                    foreach ($product->get_attributes() as $name => $option) {
                        $actual_attributes[strtolower(wc_attribute_label($name, $parent))] = $product->get_attribute($name);
                    }
                    if (empty($line['attributes'])) throw new Exception('Variation attributes are required.');
                    foreach ($line['attributes'] as $expected) {
                        $name = strtolower($expected['name']);
                        if (!isset($actual_attributes[$name]) || $actual_attributes[$name] !== $expected['option']) throw new Exception('Variation attributes changed since checkout.');
                    }
                }
                $products[] = $product;
                $line_total += $line['totalCents']; $line_tax += $line['taxCents'];
                $discount += $line['subtotalCents'] - $line['totalCents'];
            }
            foreach (array('shippingCents', 'shippingTaxCents', 'taxCents', 'totalCents', 'discountCents') as $field) lalilly_cents($data[$field]);
            if ($line_tax + $data['shippingTaxCents'] !== $data['taxCents'] || $discount !== $data['discountCents'] ||
                $line_total + $data['shippingCents'] + $data['taxCents'] !== $data['totalCents']) throw new Exception('Order totals do not balance.');
            if (empty($data['shipping']['address_1']) || !in_array($data['shipping']['country'], array('US', 'CA'), true) || !is_email($data['billing']['email'])) throw new Exception('Invalid customer details.');
            if (!$order) {
                $order = new WC_Order();
                $order->set_order_key($key);
                $order->set_created_via('lalilly');
                $order->set_status('pending');
                $order->update_meta_data('_lalilly_stripe_session', $external);
                $order->update_meta_data('_lalilly_payload_hash', $fingerprint);
                $order->update_meta_data('_lalilly_release_requested', !empty($data['release']) && !$data['test_mode'] && getenv('LALILLY_ALLOW_PAID_ORDERS') === 'true');
                $order->update_meta_data('_lalilly_test_mode', $data['test_mode']);
                $order->save();
            } elseif ($order->get_status() !== 'pending') {
                throw new Exception('Incomplete order changed status; manual review required.');
            }
            // An interrupted import stays pending. Rebuild its items before any release hook fires.
            $order->remove_order_items();
            $order->save();
            $order = new WC_Order($order->get_id());
            $order->set_currency('USD');
            $order->set_prices_include_tax(false);
            $order->set_address(wc_clean($data['shipping']), 'shipping');
            $billing = wc_clean($data['billing']);
            $actual = isset($data['billing_address']) ? $data['billing_address'] : null;
            foreach (array('address_1' => 'line1', 'address_2' => 'line2', 'city' => 'city', 'state' => 'state', 'postcode' => 'postal_code', 'country' => 'country') as $wc_field => $stripe_field) {
                $billing[$wc_field] = is_array($actual) && isset($actual[$stripe_field]) ? sanitize_text_field($actual[$stripe_field]) : '';
            }
            $order->set_address($billing, 'billing');
            $order->set_payment_method('stripe_external');
            $order->set_payment_method_title('Stripe — paid on lillypug.com');
            $order->set_transaction_id($data['transaction_id']);
            foreach ($data['lines'] as $i => $line) {
                $item = new WC_Order_Item_Product();
                $item->set_product($products[$i]);
                $item->set_quantity($line['quantity']);
                $item->set_subtotal(lalilly_cents($line['subtotalCents']));
                $item->set_total(lalilly_cents($line['totalCents']));
                // Rate 0 denotes externally calculated Stripe tax, not a WooCommerce tax rule.
                $item->set_taxes(array('subtotal' => array(0 => lalilly_cents($line['taxCents'])), 'total' => array(0 => lalilly_cents($line['taxCents']))));
                $order->add_item($item);
            }
            $shipping = new WC_Order_Item_Shipping();
            $shipping->set_method_id('lalilly_standard');
            $shipping->set_method_title('Shipping paid on lillypug.com');
            $shipping->set_total(lalilly_cents($data['shippingCents']));
            $shipping->set_taxes(array('total' => array(0 => lalilly_cents($data['shippingTaxCents']))));
            $order->add_item($shipping);
            if ($data['taxCents']) {
                $tax = new WC_Order_Item_Tax();
                $tax->set_rate_id(0); $tax->set_rate_code('STRIPE-EXTERNAL'); $tax->set_label('Tax collected via Stripe');
                $tax->set_tax_total(lalilly_cents($line_tax));
                $tax->set_shipping_tax_total(lalilly_cents($data['shippingTaxCents']));
                $order->add_item($tax);
            }
            // Stripe is authoritative. Never recalculate using unrelated Woo tax/shipping rules.
            $order->set_discount_total(lalilly_cents($data['discountCents']));
            $order->set_discount_tax(0);
            $order->set_shipping_total(lalilly_cents($data['shippingCents']));
            $order->set_shipping_tax(lalilly_cents($data['shippingTaxCents']));
            $order->set_cart_tax(lalilly_cents($line_tax));
            $order->set_total(lalilly_cents($data['totalCents']));
            $order->update_meta_data('_lalilly_import_complete', true);
            $order->update_meta_data('_lalilly_paid_at_stripe', true);
            $order->save();
        }
        // Recover a crash between the completed import save and payment/status transition.
        if ($order->get_status() === 'pending') {
            if ($order->get_meta('_lalilly_release_requested')) {
                $order->payment_complete($data['transaction_id']);
            } else {
                $order->update_status('on-hold', 'La Lilly bridge: review required. Do not submit or pay Tapstitch test orders.');
            }
        }
        return new WP_REST_Response(array('id' => $order->get_id(), 'status' => $order->get_status()), 200);
    } catch (Throwable $error) {
        // Details stay private; Stripe receives a retryable response from the storefront adapter.
        wc_get_logger()->error('La Lilly import needs review: ' . $external, array('source' => 'lalilly-bridge'));
        return new WP_Error('import_failed', 'Order import requires retry or manual review.', array('status' => 503));
    } finally {
        $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
    }
}

// Hidden means no shopper-facing catalog. Authentication, API and OAuth remain reachable.
add_action('template_redirect', function () {
    if (!is_admin()) header('X-Robots-Tag: noindex, nofollow', true);
    if (is_front_page() || (function_exists('is_shop') && (is_shop() || is_product() || is_product_taxonomy()))) {
        status_header(200);
        echo '<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><title>La Lilly backend</title></head><body><p>La Lilly order backend. <a href="https://lillypug.com">Visit La Lilly</a></p></body></html>';
        exit;
    }
});
