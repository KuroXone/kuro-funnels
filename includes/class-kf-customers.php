<?php
/**
 * Customer management: manual CRUD + automatic sync from WooCommerce.
 *
 * Listens to WC user registration and order events to keep the local customer
 * table fresh. Provides bulk sync for the initial population.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_Customers {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		if ( class_exists( 'WooCommerce' ) ) {
			add_action( 'woocommerce_new_order',                array( $this, 'sync_from_order' ), 10, 1 );
			add_action( 'woocommerce_order_status_changed',     array( $this, 'sync_from_order_status' ), 10, 4 );
			add_action( 'woocommerce_created_customer',         array( $this, 'sync_from_new_customer' ), 10, 3 );
		}
		add_action( 'user_register', array( $this, 'sync_from_wp_user' ), 10, 1 );
	}

	public function sync_from_order( $order_id ) {
		$this->sync_order( $order_id );
	}

	public function sync_from_order_status( $order_id, $from, $to, $order ) {
		$this->sync_order( $order_id, $order );
	}

	private function sync_order( $order_id, $order = null ) {
		if ( ! function_exists( 'wc_get_order' ) ) {
			return;
		}
		$order = $order ?: wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}
		$email = $order->get_billing_email();
		if ( ! is_email( $email ) ) {
			return;
		}
		$ltv = (float) $order->get_total();
		$existing = KF_DB::get_customer_by_email( $email );
		$ltv_total = ( $existing ? (float) $existing->lifetime_value : 0 );
		// Only add to LTV when the order is paid/completed to avoid double counting.
		if ( in_array( $order->get_status(), array( 'completed', 'processing' ), true ) && ( ! $existing || $existing->wc_last_order_id !== $order_id ) ) {
			$ltv_total += $ltv;
		}

		KF_DB::upsert_customer( array(
			'email'            => $email,
			'first_name'       => $order->get_billing_first_name(),
			'last_name'        => $order->get_billing_last_name(),
			'phone'            => $order->get_billing_phone(),
			'wc_user_id'       => $order->get_user_id() ?: null,
			'wc_last_order_id' => $order_id,
			'lifetime_value'   => $ltv_total,
			'source'           => 'woocommerce',
		) );
	}

	public function sync_from_new_customer( $customer_id, $new_customer_data, $password_generated ) {
		$user = get_userdata( $customer_id );
		if ( ! $user ) {
			return;
		}
		KF_DB::upsert_customer( array(
			'email'      => $user->user_email,
			'first_name' => $user->first_name,
			'last_name'  => $user->last_name,
			'wc_user_id' => $user->ID,
			'source'     => 'woocommerce',
		) );
	}

	public function sync_from_wp_user( $user_id ) {
		$user = get_userdata( $user_id );
		if ( ! $user || ! is_email( $user->user_email ) ) {
			return;
		}
		// Only sync if we don't already have them, to respect manual changes.
		if ( KF_DB::get_customer_by_email( $user->user_email ) ) {
			return;
		}
		KF_DB::upsert_customer( array(
			'email'      => $user->user_email,
			'first_name' => $user->first_name,
			'last_name'  => $user->last_name,
			'wc_user_id' => $user->ID,
			'source'     => 'wordpress',
		) );
	}

	/**
	 * One-shot bulk sync of all existing WC customers + WP users.
	 * Returns the number of records upserted.
	 */
	public static function bulk_sync() {
		$count = 0;

		// WP users.
		$users = get_users( array( 'fields' => array( 'ID', 'user_email', 'first_name', 'last_name' ) ) );
		foreach ( $users as $u ) {
			if ( ! is_email( $u->user_email ) ) {
				continue;
			}
			KF_DB::upsert_customer( array(
				'email'      => $u->user_email,
				'first_name' => $u->first_name,
				'last_name'  => $u->last_name,
				'wc_user_id' => $u->ID,
				'source'     => 'wordpress',
			) );
			$count++;
		}

		// Recent WC orders (last 1000, paid).
		if ( function_exists( 'wc_get_orders' ) ) {
			$orders = wc_get_orders( array(
				'limit'  => 1000,
				'status' => array( 'wc-completed', 'wc-processing', 'wc-on-hold', 'wc-pending' ),
				'return' => 'objects',
			) );
			foreach ( $orders as $order ) {
				$email = $order->get_billing_email();
				if ( ! is_email( $email ) ) {
					continue;
				}
				KF_DB::upsert_customer( array(
					'email'            => $email,
					'first_name'       => $order->get_billing_first_name(),
					'last_name'        => $order->get_billing_last_name(),
					'phone'            => $order->get_billing_phone(),
					'wc_user_id'       => $order->get_user_id() ?: null,
					'wc_last_order_id' => $order->get_id(),
					'lifetime_value'   => (float) $order->get_total(),
					'source'           => 'woocommerce',
				) );
				$count++;
			}
		}
		return $count;
	}

	/**
	 * Parse a CSV upload: email,first_name,last_name,phone,tags
	 */
	public static function import_csv( $file_path ) {
		if ( ! file_exists( $file_path ) ) {
			return 0;
		}
		$count = 0;
		$h = fopen( $file_path, 'r' );
		if ( ! $h ) { return 0; }
		$header = fgetcsv( $h );
		if ( ! $header ) { fclose( $h ); return 0; }
		$header = array_map( function( $c ) { return strtolower( trim( $c ) ); }, $header );

		while ( ( $row = fgetcsv( $h ) ) !== false ) {
			$data = array_combine( $header, array_pad( $row, count( $header ), '' ) );
			if ( empty( $data['email'] ) || ! is_email( $data['email'] ) ) {
				continue;
			}
			KF_DB::upsert_customer( array(
				'email'      => $data['email'],
				'first_name' => $data['first_name'] ?? '',
				'last_name'  => $data['last_name']  ?? '',
				'phone'      => $data['phone']      ?? '',
				'tags'       => $data['tags']       ?? '',
				'source'     => 'import',
			) );
			$count++;
		}
		fclose( $h );
		return $count;
	}
}
