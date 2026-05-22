<?php
/**
 * Automation engine: given a trigger event + context, find matching active
 * automations and queue (or send) the appropriate template.
 *
 * Available triggers (registered in WooCommerce module and the admin UI):
 *   - order_pending
 *   - order_on_hold
 *   - order_failed
 *   - order_completed
 *   - subscription_renewal_due  (fired by daily cron)
 *   - manual_broadcast
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_Automations {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'kf_trigger', array( $this, 'on_trigger' ), 10, 2 );
		add_action( 'kf_daily',   array( $this, 'daily_jobs' ) );
	}

	/**
	 * Main entry point. Other modules call do_action( 'kf_trigger', $event, $context )
	 *
	 * @param string $event   trigger event slug
	 * @param array  $context order_id, customer_email, customer_id, merge_extra
	 */
	public function on_trigger( $event, $context ) {
		$automations = KF_DB::automations_for_trigger( $event );
		if ( ! $automations ) {
			return;
		}

		$email = isset( $context['customer_email'] )
			? sanitize_email( $context['customer_email'] )
			: null;

		// Resolve customer record (creating if WC order context is available).
		$customer_id = $context['customer_id'] ?? null;
		if ( ! $customer_id && ! empty( $context['order_id'] ) && function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( (int) $context['order_id'] );
			if ( $order ) {
				$email = $email ?: $order->get_billing_email();
				$customer_id = KF_DB::upsert_customer( array(
					'email'            => $email,
					'first_name'       => $order->get_billing_first_name(),
					'last_name'        => $order->get_billing_last_name(),
					'phone'            => $order->get_billing_phone(),
					'wc_user_id'       => $order->get_user_id() ?: null,
					'wc_last_order_id' => $order->get_id(),
					'source'           => 'woocommerce',
				) );
			}
		}

		if ( ! $email || ! is_email( $email ) ) {
			return;
		}

		foreach ( $automations as $a ) {
			if ( ! $this->conditions_pass( $a, $context ) ) {
				continue;
			}
			$this->schedule( $a, $email, $customer_id, $context );
		}
	}

	/**
	 * Manual: broadcast a template to all active customers, honoring delays
	 * and the global cooldown.
	 */
	public static function broadcast( $template_id, $args = array() ) {
		$args = wp_parse_args( $args, array(
			'delay_hours' => 0,
			'link_pool'   => 'default',
			'limit'       => 0,
			'tag_filter'  => '',
		) );

		$template = KF_DB::get_template( $template_id );
		if ( ! $template ) {
			return 0;
		}
		$cooldown = (int) get_option( 'kf_cooldown_hours', 6 );

		$customers = KF_DB::list_customers( array( 'status' => 'active', 'limit' => $args['limit'] ?: 100000 ) );
		$queued = 0;
		foreach ( $customers as $c ) {
			if ( $args['tag_filter'] && ( ! $c->tags || stripos( $c->tags, $args['tag_filter'] ) === false ) ) {
				continue;
			}
			if ( KF_DB::recent_queue_exists( $template->id, $c->email, $cooldown ) ) {
				continue;
			}
			KF_DB::enqueue( array(
				'template_id'     => $template->id,
				'customer_id'     => $c->id,
				'recipient_email' => $c->email,
				'link_pool'       => $args['link_pool'],
				'scheduled_at'    => gmdate( 'Y-m-d H:i:s', time() + (int) $args['delay_hours'] * HOUR_IN_SECONDS ),
			) );
			$queued++;
		}
		return $queued;
	}

	private function schedule( $automation, $email, $customer_id, $context ) {
		// Respect cooldown to avoid same template double-firing.
		$cooldown = (int) get_option( 'kf_cooldown_hours', 6 );
		if ( KF_DB::recent_queue_exists( (int) $automation->template_id, $email, $cooldown ) ) {
			return;
		}

		$delay_hours = max( 0, (int) $automation->delay_hours );
		KF_DB::enqueue( array(
			'automation_id'   => $automation->id,
			'template_id'     => (int) $automation->template_id,
			'customer_id'     => $customer_id,
			'recipient_email' => $email,
			'order_id'        => $context['order_id'] ?? null,
			'link_pool'       => $automation->link_pool ?: 'default',
			'merge_data'      => isset( $context['merge_extra'] ) ? wp_json_encode( $context['merge_extra'] ) : null,
			'scheduled_at'    => gmdate( 'Y-m-d H:i:s', time() + $delay_hours * HOUR_IN_SECONDS ),
		) );
	}

	private function conditions_pass( $automation, $context ) {
		// Future: parse $automation->conditions (JSON) for min_order_total, country, etc.
		if ( empty( $automation->conditions ) ) {
			return true;
		}
		$cond = json_decode( $automation->conditions, true );
		if ( ! is_array( $cond ) ) {
			return true;
		}
		if ( ! empty( $cond['min_order_total'] ) && ! empty( $context['order_id'] ) && function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( (int) $context['order_id'] );
			if ( $order && (float) $order->get_total() < (float) $cond['min_order_total'] ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Daily scan: fire renewal-due triggers for active WC subscriptions whose
	 * next payment lands in the renewal window.
	 */
	public function daily_jobs() {
		if ( ! function_exists( 'wcs_get_subscriptions' ) ) {
			return;
		}
		$days = (int) get_option( 'kf_renewal_days_before', 7 );
		$start = gmdate( 'Y-m-d 00:00:00', time() + $days * DAY_IN_SECONDS );
		$end   = gmdate( 'Y-m-d 23:59:59', time() + $days * DAY_IN_SECONDS );

		$subs = wcs_get_subscriptions( array(
			'subscription_status'    => 'active',
			'subscriptions_per_page' => -1,
		) );
		foreach ( $subs as $sub ) {
			$next = $sub->get_date( 'next_payment' );
			if ( ! $next || $next < $start || $next > $end ) {
				continue;
			}
			do_action( 'kf_trigger', 'subscription_renewal_due', array(
				'order_id'       => $sub->get_id(),
				'customer_email' => $sub->get_billing_email(),
				'merge_extra'    => array(
					'next_payment_date' => $next,
				),
			) );
		}
	}
}
