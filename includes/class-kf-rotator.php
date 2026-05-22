<?php
/**
 * Link rotator.
 *
 * Strategies (admin-selectable):
 *   - no_repeat (default) : Round-robin by last_used_at, with a hard guard against
 *                           re-using a link the same recipient just received within
 *                           the configured cooldown window. Only repeats if the pool
 *                           is fully exhausted.
 *   - round_robin         : Pure least-recently-used.
 *   - random              : Uniform random.
 *   - weighted            : Weighted random by `weight`.
 *
 * Concurrency-safe via short transient lock so two parallel cron workers can't
 * race to the same link.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_Rotator {

	const LOCK_PREFIX = 'kf_rot_lock_';
	const LOCK_TTL    = 5;

	/**
	 * Pick + reserve a link, log the send. Returns the public tracked URL.
	 *
	 * @param array $ctx pool, email, customer_id, order_id, context
	 * @return array|null [ 'tracked_url' => string, 'link' => object, 'token' => string, 'log_id' => int ]
	 */
	public static function pick_for( array $ctx ) {
		$ctx = wp_parse_args( $ctx, array(
			'pool' => 'default', 'email' => null, 'customer_id' => null,
			'order_id' => null, 'context' => null,
		) );

		$lock = self::LOCK_PREFIX . md5( $ctx['pool'] );
		$wait = 0.0;
		while ( get_transient( $lock ) && $wait < self::LOCK_TTL ) {
			usleep( 100000 );
			$wait += 0.1;
		}
		set_transient( $lock, 1, self::LOCK_TTL );

		try {
			$link = self::select_link( $ctx );
			if ( ! $link ) {
				return null;
			}

			$token = wp_generate_password( 32, false, false );
			$log_id = KF_DB::log_send( array(
				'link_id'     => $link->id,
				'customer_id' => $ctx['customer_id'],
				'order_id'    => $ctx['order_id'],
				'email'       => $ctx['email'],
				'token'       => $token,
				'context'     => $ctx['context'],
			) );

			$tracked = self::tracked_url( $token );

			return array(
				'tracked_url' => $tracked,
				'link'        => $link,
				'token'       => $token,
				'log_id'      => $log_id,
			);
		} finally {
			delete_transient( $lock );
		}
	}

	private static function select_link( $ctx ) {
		$strategy = get_option( 'kf_rotation_strategy', 'no_repeat' );
		$links = KF_DB::eligible_links( $ctx['pool'] );
		if ( empty( $links ) ) {
			return null;
		}

		switch ( $strategy ) {
			case 'random':
				return $links[ array_rand( $links ) ];

			case 'weighted':
				return self::weighted_pick( $links );

			case 'round_robin':
				return self::round_robin( $links );

			case 'no_repeat':
			default:
				return self::no_repeat( $links, $ctx );
		}
	}

	/**
	 * Avoid sending the same link to the same recipient consecutively, and avoid
	 * any link the recipient received within the cooldown window. Falls back to
	 * round-robin if exhausted.
	 */
	private static function no_repeat( $links, $ctx ) {
		$cooldown = (int) get_option( 'kf_cooldown_hours', 6 );

		$recent  = $ctx['email'] ? KF_DB::recent_sends_link_ids( $ctx['email'], $cooldown ) : array();
		$last_id = $ctx['email'] ? KF_DB::last_link_id_for_email( $ctx['email'] ) : 0;

		// Filter out recently-sent links AND the immediately-previous one.
		$filtered = array_values( array_filter( $links, function ( $l ) use ( $recent, $last_id ) {
			if ( $last_id && (int) $l->id === $last_id ) {
				return false;
			}
			if ( in_array( (int) $l->id, $recent, true ) ) {
				return false;
			}
			return true;
		} ) );

		// Pool exhausted? Fall back to least-recently-used from the full set.
		if ( empty( $filtered ) ) {
			KF_Logger::log( sprintf( 'Pool "%s" exhausted for %s — falling back to LRU.', $ctx['pool'], $ctx['email'] ), 'warn' );
			return self::round_robin( $links );
		}

		return self::round_robin( $filtered );
	}

	private static function round_robin( $links ) {
		usort( $links, function ( $a, $b ) {
			$at = $a->last_used_at ? strtotime( $a->last_used_at ) : 0;
			$bt = $b->last_used_at ? strtotime( $b->last_used_at ) : 0;
			if ( $at === $bt ) {
				return (int) $a->id - (int) $b->id;
			}
			return $at - $bt;
		} );
		return $links[0];
	}

	private static function weighted_pick( $links ) {
		$total = 0;
		foreach ( $links as $l ) {
			$total += max( 1, (int) $l->weight );
		}
		$r = wp_rand( 1, max( 1, $total ) );
		$acc = 0;
		foreach ( $links as $l ) {
			$acc += max( 1, (int) $l->weight );
			if ( $r <= $acc ) {
				return $l;
			}
		}
		return $links[0];
	}

	public static function tracked_url( $token ) {
		// Pretty URL: /kf-go/<token> when permalinks are enabled, falls back to ?kf_go=
		return home_url( '/?kf_go=' . rawurlencode( $token ) );
	}
}
