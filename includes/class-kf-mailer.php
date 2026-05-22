<?php
/**
 * The mailer ties everything together:
 *   1. Build merge variables from customer + WC order context.
 *   2. Pick a rotated link from the pool (one per send, guaranteed unique vs
 *      what this recipient just received).
 *   3. Render the branded template with one Pay Now button.
 *   4. Send via wp_mail (which is routed through Zoho SMTP).
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_Mailer {

	/**
	 * Send immediately to a single recipient.
	 *
	 * @param int   $template_id
	 * @param array $recipient  [ email, customer_id?, order_id?, automation_id?, link_pool? ]
	 * @return bool
	 */
	public static function send_now( $template_id, array $recipient ) {
		$template = KF_DB::get_template( $template_id );
		if ( ! $template ) {
			KF_Logger::log( 'Template missing: ' . $template_id, 'error' );
			return false;
		}
		return self::dispatch( $template, $recipient );
	}

	/**
	 * Process due queued emails. Each send picks a fresh rotated link.
	 */
	public static function process_queue( $batch = 25 ) {
		$rows = KF_DB::due_queue( $batch );
		foreach ( $rows as $row ) {
			$template = KF_DB::get_template( $row->template_id );
			if ( ! $template ) {
				KF_DB::update_queue( $row->id, array( 'status' => 'failed', 'last_error' => 'Template missing' ) );
				continue;
			}

			$recipient = array(
				'email'         => $row->recipient_email,
				'customer_id'   => $row->customer_id,
				'order_id'      => $row->order_id,
				'automation_id' => $row->automation_id,
				'link_pool'     => $row->link_pool,
				'merge_extra'   => $row->merge_data ? json_decode( $row->merge_data, true ) : array(),
			);

			$ok = self::dispatch( $template, $recipient );

			KF_DB::update_queue( $row->id, array(
				'status'     => $ok ? 'sent' : 'failed',
				'attempts'   => (int) $row->attempts + 1,
				'sent_at'    => $ok ? current_time( 'mysql' ) : null,
				'last_error' => $ok ? null : 'Dispatch failed',
			) );

			if ( $ok && $row->automation_id ) {
				KF_DB::bump_automation_stat( $row->automation_id, 'stats_sent' );
			}
		}
	}

	/**
	 * Core dispatcher. NOT exposed publicly — all routes go through send_now or queue.
	 */
	private static function dispatch( $template, array $recipient ) {
		$email = isset( $recipient['email'] ) ? sanitize_email( $recipient['email'] ) : '';
		if ( ! is_email( $email ) ) {
			return false;
		}

		// Build merge variables from whatever context we have.
		$vars = self::build_vars( $recipient );

		// Reserve a rotated link.
		$picked = KF_Rotator::pick_for( array(
			'pool'        => $recipient['link_pool'] ?? 'default',
			'email'       => $email,
			'customer_id' => $recipient['customer_id'] ?? null,
			'order_id'    => $recipient['order_id'] ?? null,
			'context'     => isset( $recipient['automation_id'] )
				? 'automation:' . (int) $recipient['automation_id']
				: 'template:' . (int) $template->id,
		) );

		if ( ! $picked ) {
			KF_Logger::log( sprintf( 'No eligible links in pool "%s" for %s', $recipient['link_pool'] ?? 'default', $email ), 'error' );
			return false;
		}

		$rendered = KF_Templates::render( $template, $picked['tracked_url'], $vars );

		$headers = array(
			'Content-Type: text/html; charset=UTF-8',
		);
		$from = get_option( 'kf_smtp_from_email' );
		$from_name = get_option( 'kf_smtp_from_name' );
		if ( $from && $from_name ) {
			$headers[] = sprintf( 'From: %s <%s>', $from_name, $from );
		}

		return wp_mail( $email, $rendered['subject'], $rendered['html'], $headers );
	}

	private static function build_vars( $recipient ) {
		$first = $last = '';
		$order_id = $order_total = $order_items = '';

		if ( ! empty( $recipient['customer_id'] ) ) {
			$c = KF_DB::get_customer( (int) $recipient['customer_id'] );
			if ( $c ) {
				$first = $c->first_name;
				$last  = $c->last_name;
			}
		}

		if ( ! empty( $recipient['order_id'] ) && function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( (int) $recipient['order_id'] );
			if ( $order ) {
				$order_id    = '#' . $order->get_order_number();
				$order_total = wp_strip_all_tags( wc_price( $order->get_total() ) );
				$items = array();
				foreach ( $order->get_items() as $item ) {
					$items[] = $item->get_name() . ' × ' . $item->get_quantity();
				}
				$order_items = implode( ', ', $items );
				if ( ! $first ) { $first = $order->get_billing_first_name(); }
				if ( ! $last )  { $last  = $order->get_billing_last_name(); }
			}
		}

		$vars = array(
			'{first_name}'  => $first,
			'{last_name}'   => $last,
			'{full_name}'   => trim( $first . ' ' . $last ),
			'{email}'       => $recipient['email'],
			'{order_id}'    => $order_id,
			'{order_total}' => $order_total,
			'{order_items}' => $order_items,
		);

		if ( ! empty( $recipient['merge_extra'] ) && is_array( $recipient['merge_extra'] ) ) {
			foreach ( $recipient['merge_extra'] as $k => $v ) {
				$key = '{' . trim( $k, '{}' ) . '}';
				$vars[ $key ] = (string) $v;
			}
		}

		return $vars;
	}
}
