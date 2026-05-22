<?php
/**
 * Runs only when the plugin is deleted via the WP UI.
 */
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

$tables = array( 'customers', 'links', 'link_log', 'templates', 'automations', 'queue' );
foreach ( $tables as $t ) {
	$tbl = $wpdb->prefix . 'kf_' . $t;
	$wpdb->query( "DROP TABLE IF EXISTS {$tbl}" );
}

$opts = array(
	'kf_rotation_strategy','kf_smtp_host','kf_smtp_port','kf_smtp_encryption','kf_smtp_username',
	'kf_smtp_password','kf_smtp_from_email','kf_smtp_from_name','kf_reminder_first_after',
	'kf_reminder_second_after','kf_renewal_days_before','kf_followup_after_days',
	'kf_brand_accent','kf_brand_logo_url','kf_brand_support_email','kf_cooldown_hours',
);
foreach ( $opts as $o ) {
	delete_option( $o );
}
