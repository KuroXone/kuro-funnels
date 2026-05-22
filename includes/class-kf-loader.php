<?php
/**
 * Bootstraps every module and handles activation lifecycle.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_Loader {

	public static function init() {
		// Core modules.
		require_once KF_PLUGIN_DIR . 'includes/class-kf-db.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-logger.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-rotator.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-templates.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-smtp.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-mailer.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-customers.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-automations.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-woocommerce.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-cron.php';

		KF_SMTP::instance();
		KF_Cron::instance();
		KF_Customers::instance();
		KF_Automations::instance();
		KF_WooCommerce::instance();

		if ( is_admin() ) {
			require_once KF_PLUGIN_DIR . 'admin/class-kf-admin.php';
			KF_Admin::instance();
		}

		load_plugin_textdomain( 'kuro-funnels', false, dirname( KF_PLUGIN_BASENAME ) . '/languages' );
	}

	public static function activate() {
		require_once KF_PLUGIN_DIR . 'includes/class-kf-db.php';
		require_once KF_PLUGIN_DIR . 'includes/class-kf-templates.php';
		KF_DB::create_tables();
		KF_Templates::seed_defaults();

		$defaults = array(
			'rotation_strategy'      => 'no_repeat',
			'smtp_host'              => 'smtp.zoho.com',
			'smtp_port'              => 587,
			'smtp_encryption'        => 'tls',
			'smtp_username'          => '',
			'smtp_password'          => '',
			'smtp_from_email'        => '',
			'smtp_from_name'         => get_bloginfo( 'name' ),
			'reminder_first_after'   => 24,   // hours after pending
			'reminder_second_after'  => 72,
			'renewal_days_before'    => 7,
			'followup_after_days'    => 14,
			'brand_accent'           => '#5b46f6',
			'brand_logo_url'         => '',
			'brand_support_email'    => '',
			'cooldown_hours'         => 6,
		);
		foreach ( $defaults as $k => $v ) {
			if ( false === get_option( 'kf_' . $k ) ) {
				add_option( 'kf_' . $k, $v );
			}
		}

		if ( ! wp_next_scheduled( 'kf_every_15min' ) ) {
			wp_schedule_event( time(), 'kf_quarter_hour', 'kf_every_15min' );
		}
		if ( ! wp_next_scheduled( 'kf_daily' ) ) {
			wp_schedule_event( time(), 'daily', 'kf_daily' );
		}
	}

	public static function deactivate() {
		wp_clear_scheduled_hook( 'kf_every_15min' );
		wp_clear_scheduled_hook( 'kf_daily' );
	}
}

// Register custom 15-minute cron interval.
add_filter( 'cron_schedules', function ( $s ) {
	$s['kf_quarter_hour'] = array(
		'interval' => 15 * MINUTE_IN_SECONDS,
		'display'  => __( 'Every 15 minutes (Kuro Funnels)', 'kuro-funnels' ),
	);
	return $s;
} );
