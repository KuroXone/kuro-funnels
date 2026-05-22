<?php
/**
 * Plugin Name:       Kuro Funnels
 * Plugin URI:        https://example.com/kuro-funnels
 * Description:       Professional funnel automation for WooCommerce with intelligent payment-link rotation, Zoho SMTP, and modern email workflows. Built by Kuro X.
 * Version:           1.0.0
 * Author:            Kuro X
 * Author URI:        https://example.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       kuro-funnels
 * Domain Path:       /languages
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * WC requires at least: 7.0
 * WC tested up to:   9.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'KF_VERSION',         '1.0.0' );
define( 'KF_PLUGIN_FILE',     __FILE__ );
define( 'KF_PLUGIN_DIR',      plugin_dir_path( __FILE__ ) );
define( 'KF_PLUGIN_URL',      plugin_dir_url( __FILE__ ) );
define( 'KF_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

require_once KF_PLUGIN_DIR . 'includes/class-kf-loader.php';

register_activation_hook(   __FILE__, array( 'KF_Loader', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'KF_Loader', 'deactivate' ) );

add_action( 'plugins_loaded', array( 'KF_Loader', 'init' ) );
