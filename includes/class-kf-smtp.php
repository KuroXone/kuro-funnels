<?php
/**
 * Routes all wp_mail() traffic through Zoho SMTP using the credentials stored
 * by the admin settings page. Leaves WordPress's default mail untouched if not
 * configured, so the site doesn't break before setup.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_SMTP {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'phpmailer_init',     array( $this, 'configure' ) );
		add_filter( 'wp_mail_from',       array( $this, 'from_email' ) );
		add_filter( 'wp_mail_from_name',  array( $this, 'from_name' ) );
		add_action( 'wp_mail_failed',     array( $this, 'capture_failure' ) );
	}

	public function configure( $mailer ) {
		$host = get_option( 'kf_smtp_host' );
		$user = get_option( 'kf_smtp_username' );
		$pass = get_option( 'kf_smtp_password' );
		if ( ! $host || ! $user || ! $pass ) {
			return;
		}
		$mailer->isSMTP();
		$mailer->Host       = $host;
		$mailer->SMTPAuth   = true;
		$mailer->Port       = (int) get_option( 'kf_smtp_port', 587 );
		$mailer->Username   = $user;
		$mailer->Password   = $pass;
		$enc                = get_option( 'kf_smtp_encryption', 'tls' );
		$mailer->SMTPSecure = ( $enc === 'none' ) ? '' : $enc;
		$mailer->Timeout    = 15;
		$mailer->CharSet    = 'UTF-8';
	}

	public function from_email( $email ) {
		$from = get_option( 'kf_smtp_from_email' );
		return $from ? $from : $email;
	}

	public function from_name( $name ) {
		$from = get_option( 'kf_smtp_from_name' );
		return $from ? $from : $name;
	}

	public function capture_failure( $error ) {
		KF_Logger::log( 'wp_mail failed: ' . $error->get_error_message(), 'error' );
	}
}
