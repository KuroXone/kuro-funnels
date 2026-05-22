<?php
/**
 * WooCommerce bridge: translates WC events into kf_trigger actions that the
 * automations engine consumes. Also schedules order follow-ups after delivery.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_WooCommerce {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		add_action( 'woocommerce_order_status_pending',   array( $this, 'on_pending' ) );
		add_action( 'woocommerce_order_status_on-hold',   array( $this, 'on_on_hold' ) );
		add_action( 'woocommerce_order_status_failed',    array( $this, 'on_failed' ) );
		add_action( 'woocommerce_order_status_completed', array( $this, 'on_completed' ) );

		// Periodic check for stale pending orders (in case status didn't fire).
		add_action( 'kf_every_15min', array( $this, 'scan_stale_pending' ) );
	}

	public function on_pending( $order_id ) {
		do_action( 'kf_trigger', 'order_pending', array( 'order_id' => $order_id ) );
	}
	public function on_on_hold( $order_id ) {
		do_action( 'kf_trigger', 'order_on_hold', array( 'order_id' => $order_id ) );
	}
	public function on_failed( $order_id ) {
		do_action( 'kf_trigger', 'order_failed', array( 'order_id' => $order_id ) );
	}
	public function on_completed( $order_id ) {
		do_action( 'kf_trigger', 'order_completed', array( 'order_id' => $order_id ) );
	}

	/**
	 * Catch orders that have been stuck in pending/failed beyond the reminder
	 * threshold and fire the reminder trigger one more time. Cooldown in the
	 * automations module prevents duplicates.
	 */
	public function scan_stale_pending() {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return;
		}
		$hours = (int) get_option( 'kf_reminder_second_after', 72 );
		$cutoff = gmdate( 'Y-m-d H:i:s', time() - $hours * HOUR_IN_SECONDS );
		$orders = wc_get_orders( array(
			'status'       => array( 'wc-pending', 'wc-failed' ),
			'date_created' => '<' . strtotime( $cutoff ),
			'limit'        => 50,
		) );
		foreach ( $orders as $order ) {
			do_action( 'kf_trigger', 'order_pending', array( 'order_id' => $order->get_id() ) );
		}
	}
}
