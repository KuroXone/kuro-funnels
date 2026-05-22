<?php
/**
 * Admin: menu structure, assets, and POST handlers for the dashboard.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_Admin {

	const CAP   = 'manage_options';
	const NONCE = 'kf_admin_nonce';

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'admin_menu',            array( $this, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'assets' ) );

		// POST handlers.
		add_action( 'admin_post_kf_save_link',       array( $this, 'h_save_link' ) );
		add_action( 'admin_post_kf_delete_link',     array( $this, 'h_delete_link' ) );
		add_action( 'admin_post_kf_save_customer',   array( $this, 'h_save_customer' ) );
		add_action( 'admin_post_kf_delete_customer', array( $this, 'h_delete_customer' ) );
		add_action( 'admin_post_kf_import_csv',      array( $this, 'h_import_csv' ) );
		add_action( 'admin_post_kf_bulk_sync',       array( $this, 'h_bulk_sync' ) );
		add_action( 'admin_post_kf_save_template',   array( $this, 'h_save_template' ) );
		add_action( 'admin_post_kf_delete_template', array( $this, 'h_delete_template' ) );
		add_action( 'admin_post_kf_save_automation', array( $this, 'h_save_automation' ) );
		add_action( 'admin_post_kf_delete_automation', array( $this, 'h_delete_automation' ) );
		add_action( 'admin_post_kf_broadcast',       array( $this, 'h_broadcast' ) );
		add_action( 'admin_post_kf_save_settings',   array( $this, 'h_save_settings' ) );
		add_action( 'admin_post_kf_test_email',      array( $this, 'h_test_email' ) );
	}

	public function menu() {
		$icon = 'data:image/svg+xml;base64,' . base64_encode(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#a7aaad"><path d="M4 5h16v3H4zM4 10.5h11v3H4zM4 16h7v3H4z"/><circle cx="19.5" cy="11.5" r="2.2"/><circle cx="15.5" cy="17.5" r="1.8"/></svg>'
		);

		add_menu_page(
			__( 'Kuro Funnels', 'kuro-funnels' ),
			__( 'Kuro Funnels', 'kuro-funnels' ),
			self::CAP,
			'kuro-funnels',
			array( $this, 'r_dashboard' ),
			$icon,
			56
		);
		$pages = array(
			array( 'kuro-funnels',             __( 'Dashboard', 'kuro-funnels' ),   'r_dashboard' ),
			array( 'kuro-funnels-customers',   __( 'Customers', 'kuro-funnels' ),   'r_customers' ),
			array( 'kuro-funnels-links',       __( 'Payment links', 'kuro-funnels' ),'r_links' ),
			array( 'kuro-funnels-templates',   __( 'Email templates', 'kuro-funnels' ),'r_templates' ),
			array( 'kuro-funnels-automations', __( 'Automations', 'kuro-funnels' ), 'r_automations' ),
			array( 'kuro-funnels-broadcast',   __( 'Broadcast', 'kuro-funnels' ),   'r_broadcast' ),
			array( 'kuro-funnels-settings',    __( 'Settings', 'kuro-funnels' ),    'r_settings' ),
		);
		foreach ( $pages as $p ) {
			add_submenu_page( 'kuro-funnels', $p[1], $p[1], self::CAP, $p[0], array( $this, $p[2] ) );
		}
	}

	public function assets( $hook ) {
		if ( strpos( (string) $hook, 'kuro-funnels' ) === false ) {
			return;
		}
		wp_enqueue_style( 'kf-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap', array(), null );
		wp_enqueue_style( 'kf-admin', KF_PLUGIN_URL . 'admin/assets/css/admin.css', array(), KF_VERSION );
		wp_enqueue_script( 'kf-admin', KF_PLUGIN_URL . 'admin/assets/js/admin.js', array( 'jquery' ), KF_VERSION, true );
	}

	/* ---------- Render dispatchers ---------- */

	public function r_dashboard()   { $this->view( 'dashboard' ); }
	public function r_customers()   { $this->view( 'customers' ); }
	public function r_links()       { $this->view( 'links' ); }
	public function r_templates()   { $this->view( 'templates' ); }
	public function r_automations() { $this->view( 'automations' ); }
	public function r_broadcast()   { $this->view( 'broadcast' ); }
	public function r_settings()    { $this->view( 'settings' ); }

	private function view( $slug ) {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'Permission denied.', 'kuro-funnels' ) );
		}
		include KF_PLUGIN_DIR . 'admin/views/header.php';
		include KF_PLUGIN_DIR . 'admin/views/' . $slug . '.php';
		include KF_PLUGIN_DIR . 'admin/views/footer.php';
	}

	private function verify() {
		if ( ! current_user_can( self::CAP ) ) { wp_die( 'Forbidden' ); }
		check_admin_referer( self::NONCE );
	}

	private function back( $page, $params = array() ) {
		$url = add_query_arg( array_merge( array( 'page' => $page ), $params ), admin_url( 'admin.php' ) );
		wp_safe_redirect( $url );
		exit;
	}

	/* ---------- Handlers ---------- */

	public function h_save_link() {
		$this->verify();
		$id = (int) ( $_POST['id'] ?? 0 );
		$data = array(
			'label'    => sanitize_text_field( wp_unslash( $_POST['label'] ?? '' ) ),
			'url'      => esc_url_raw( wp_unslash( $_POST['url'] ?? '' ) ),
			'provider' => sanitize_text_field( wp_unslash( $_POST['provider'] ?? '' ) ),
			'pool'     => sanitize_key( $_POST['pool'] ?? 'default' ),
			'weight'   => max( 1, (int) ( $_POST['weight'] ?? 1 ) ),
			'max_uses' => max( 0, (int) ( $_POST['max_uses'] ?? 0 ) ),
			'active'   => isset( $_POST['active'] ) ? 1 : 0,
			'notes'    => sanitize_textarea_field( wp_unslash( $_POST['notes'] ?? '' ) ),
		);
		if ( $id ) { KF_DB::update_link( $id, $data ); } else { KF_DB::insert_link( $data ); }
		$this->back( 'kuro-funnels-links', array( 'msg' => 'saved' ) );
	}

	public function h_delete_link() {
		$this->verify();
		KF_DB::delete_link( (int) ( $_GET['id'] ?? 0 ) );
		$this->back( 'kuro-funnels-links', array( 'msg' => 'deleted' ) );
	}

	public function h_save_customer() {
		$this->verify();
		$id = (int) ( $_POST['id'] ?? 0 );
		$data = array(
			'email'      => sanitize_email( wp_unslash( $_POST['email'] ?? '' ) ),
			'first_name' => sanitize_text_field( wp_unslash( $_POST['first_name'] ?? '' ) ),
			'last_name'  => sanitize_text_field( wp_unslash( $_POST['last_name'] ?? '' ) ),
			'phone'      => sanitize_text_field( wp_unslash( $_POST['phone'] ?? '' ) ),
			'tags'       => sanitize_text_field( wp_unslash( $_POST['tags'] ?? '' ) ),
			'status'     => sanitize_key( $_POST['status'] ?? 'active' ),
			'source'     => 'manual',
		);
		KF_DB::upsert_customer( $data );
		$this->back( 'kuro-funnels-customers', array( 'msg' => 'saved' ) );
	}

	public function h_delete_customer() {
		$this->verify();
		KF_DB::delete_customer( (int) ( $_GET['id'] ?? 0 ) );
		$this->back( 'kuro-funnels-customers', array( 'msg' => 'deleted' ) );
	}

	public function h_import_csv() {
		$this->verify();
		if ( ! empty( $_FILES['csv']['tmp_name'] ) ) {
			$count = KF_Customers::import_csv( $_FILES['csv']['tmp_name'] );
			$this->back( 'kuro-funnels-customers', array( 'msg' => 'imported', 'count' => $count ) );
		}
		$this->back( 'kuro-funnels-customers', array( 'msg' => 'import_failed' ) );
	}

	public function h_bulk_sync() {
		$this->verify();
		$count = KF_Customers::bulk_sync();
		$this->back( 'kuro-funnels-customers', array( 'msg' => 'synced', 'count' => $count ) );
	}

	public function h_save_template() {
		$this->verify();
		$id = (int) ( $_POST['id'] ?? 0 );
		$slug = sanitize_title( $_POST['slug'] ?? '' );
		if ( ! $slug ) { $slug = sanitize_title( $_POST['name'] ?? 'template-' . time() ); }
		$data = array(
			'name'      => sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) ),
			'slug'      => $slug,
			'subject'   => sanitize_text_field( wp_unslash( $_POST['subject'] ?? '' ) ),
			'heading'   => sanitize_text_field( wp_unslash( $_POST['heading'] ?? '' ) ),
			'body'      => wp_kses_post( wp_unslash( $_POST['body'] ?? '' ) ),
			'cta_label' => sanitize_text_field( wp_unslash( $_POST['cta_label'] ?? 'Pay Now' ) ),
		);
		if ( $id ) { KF_DB::update_template( $id, $data ); } else { KF_DB::insert_template( $data ); }
		$this->back( 'kuro-funnels-templates', array( 'msg' => 'saved' ) );
	}

	public function h_delete_template() {
		$this->verify();
		KF_DB::delete_template( (int) ( $_GET['id'] ?? 0 ) );
		$this->back( 'kuro-funnels-templates', array( 'msg' => 'deleted' ) );
	}

	public function h_save_automation() {
		$this->verify();
		$id = (int) ( $_POST['id'] ?? 0 );
		$conds = array();
		if ( ! empty( $_POST['min_order_total'] ) ) {
			$conds['min_order_total'] = (float) $_POST['min_order_total'];
		}
		$data = array(
			'name'          => sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) ),
			'trigger_event' => sanitize_key( $_POST['trigger_event'] ?? 'order_pending' ),
			'template_id'   => (int) ( $_POST['template_id'] ?? 0 ),
			'link_pool'     => sanitize_key( $_POST['link_pool'] ?? 'default' ),
			'delay_hours'   => max( 0, (int) ( $_POST['delay_hours'] ?? 0 ) ),
			'conditions'    => $conds ? wp_json_encode( $conds ) : null,
			'active'        => isset( $_POST['active'] ) ? 1 : 0,
		);
		if ( $id ) { KF_DB::update_automation( $id, $data ); } else { KF_DB::insert_automation( $data ); }
		$this->back( 'kuro-funnels-automations', array( 'msg' => 'saved' ) );
	}

	public function h_delete_automation() {
		$this->verify();
		KF_DB::delete_automation( (int) ( $_GET['id'] ?? 0 ) );
		$this->back( 'kuro-funnels-automations', array( 'msg' => 'deleted' ) );
	}

	public function h_broadcast() {
		$this->verify();
		$count = KF_Automations::broadcast( (int) ( $_POST['template_id'] ?? 0 ), array(
			'delay_hours' => (int) ( $_POST['delay_hours'] ?? 0 ),
			'link_pool'   => sanitize_key( $_POST['link_pool'] ?? 'default' ),
			'limit'       => (int) ( $_POST['limit'] ?? 0 ),
			'tag_filter'  => sanitize_text_field( wp_unslash( $_POST['tag_filter'] ?? '' ) ),
		) );
		$this->back( 'kuro-funnels-broadcast', array( 'msg' => 'queued', 'count' => $count ) );
	}

	public function h_save_settings() {
		$this->verify();
		$opts = array(
			'kf_rotation_strategy'      => sanitize_key( $_POST['rotation_strategy'] ?? 'no_repeat' ),
			'kf_smtp_host'              => sanitize_text_field( wp_unslash( $_POST['smtp_host'] ?? '' ) ),
			'kf_smtp_port'              => (int) ( $_POST['smtp_port'] ?? 587 ),
			'kf_smtp_encryption'        => sanitize_key( $_POST['smtp_encryption'] ?? 'tls' ),
			'kf_smtp_username'          => sanitize_text_field( wp_unslash( $_POST['smtp_username'] ?? '' ) ),
			'kf_smtp_from_email'        => sanitize_email( wp_unslash( $_POST['smtp_from_email'] ?? '' ) ),
			'kf_smtp_from_name'         => sanitize_text_field( wp_unslash( $_POST['smtp_from_name'] ?? '' ) ),
			'kf_brand_accent'           => sanitize_hex_color( $_POST['brand_accent'] ?? '#5b46f6' ) ?: '#5b46f6',
			'kf_brand_logo_url'         => esc_url_raw( wp_unslash( $_POST['brand_logo_url'] ?? '' ) ),
			'kf_brand_support_email'    => sanitize_email( wp_unslash( $_POST['brand_support_email'] ?? '' ) ),
			'kf_renewal_days_before'    => max( 1, (int) ( $_POST['renewal_days_before'] ?? 7 ) ),
			'kf_cooldown_hours'         => max( 0, (int) ( $_POST['cooldown_hours'] ?? 6 ) ),
			'kf_reminder_first_after'   => max( 0, (int) ( $_POST['reminder_first_after'] ?? 24 ) ),
			'kf_reminder_second_after'  => max( 0, (int) ( $_POST['reminder_second_after'] ?? 72 ) ),
			'kf_followup_after_days'    => max( 0, (int) ( $_POST['followup_after_days'] ?? 14 ) ),
		);
		foreach ( $opts as $k => $v ) {
			update_option( $k, $v );
		}
		// Password: only update if a new value is typed.
		if ( ! empty( $_POST['smtp_password'] ) ) {
			update_option( 'kf_smtp_password', wp_unslash( $_POST['smtp_password'] ) );
		}
		$this->back( 'kuro-funnels-settings', array( 'msg' => 'saved' ) );
	}

	public function h_test_email() {
		$this->verify();
		$to = sanitize_email( wp_unslash( $_POST['to'] ?? '' ) );
		if ( ! is_email( $to ) ) {
			$this->back( 'kuro-funnels-settings', array( 'msg' => 'test_failed' ) );
		}
		$ok = wp_mail(
			$to,
			'Kuro Funnels — SMTP test',
			'<p>If you can read this, your Zoho SMTP is configured correctly.</p>',
			array( 'Content-Type: text/html; charset=UTF-8' )
		);
		$this->back( 'kuro-funnels-settings', array( 'msg' => $ok ? 'test_ok' : 'test_failed' ) );
	}
}
