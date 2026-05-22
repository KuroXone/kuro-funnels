<?php
/**
 * Cron tick + the public /kf-go/<token> click-tracking redirect.
 *
 * The redirect is the ONLY public-facing surface. To the customer, every email
 * contains a single tracked URL on this site that quietly forwards them to the
 * real payment/booking destination — they never see the rotation logic.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_Cron {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'kf_every_15min', array( $this, 'tick' ) );
		add_action( 'admin_init',     array( $this, 'inline_tick' ) );

		add_action( 'init',           array( $this, 'register_redirect' ) );
		add_action( 'template_redirect', array( $this, 'handle_redirect' ) );
	}

	public function tick() {
		KF_Mailer::process_queue( 50 );
	}

	/**
	 * Cheap nudge when an admin is browsing: don't rely on WP cron alone on
	 * low-traffic sites.
	 */
	public function inline_tick() {
		if ( get_transient( 'kf_inline_lock' ) ) {
			return;
		}
		set_transient( 'kf_inline_lock', 1, 2 * MINUTE_IN_SECONDS );
		KF_Mailer::process_queue( 10 );
	}

	public function register_redirect() {
		add_rewrite_rule( '^kf-go/([^/]+)/?', 'index.php?kf_go=$matches[1]', 'top' );
		add_rewrite_tag( '%kf_go%', '([^&]+)' );
	}

	public function handle_redirect() {
		$token = isset( $_GET['kf_go'] ) ? sanitize_text_field( wp_unslash( $_GET['kf_go'] ) ) : '';
		if ( ! $token ) {
			$qv = get_query_var( 'kf_go' );
			$token = $qv ? sanitize_text_field( $qv ) : '';
		}
		if ( ! $token ) {
			return;
		}

		$log = KF_DB::get_log_by_token( $token );
		if ( ! $log ) {
			wp_safe_redirect( home_url( '/' ), 302 );
			exit;
		}

		$link = KF_DB::get_link( (int) $log->link_id );
		if ( ! $link || ! $link->url ) {
			wp_safe_redirect( home_url( '/' ), 302 );
			exit;
		}

		// Record the click (idempotent).
		KF_DB::mark_clicked( $token );

		// Bump automation click stat exactly once.
		if ( ! $log->clicked_at ) {
			global $wpdb;
			$row = $wpdb->get_row( $wpdb->prepare(
				"SELECT automation_id FROM " . KF_DB::t( 'queue' ) . " WHERE link_log_id = %d LIMIT 1",
				(int) $log->id
			) );
			if ( $row && $row->automation_id ) {
				KF_DB::bump_automation_stat( (int) $row->automation_id, 'stats_clicked' );
			}
		}

		// Forward to the real destination. Use 302 (temporary) so analytics tools
		// don't cache and so the rotated link can be retired later.
		wp_redirect( $link->url, 302 );
		exit;
	}
}
