<?php
/**
 * Lightweight file logger at wp-content/uploads/kf-logs/log.txt.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_Logger {

	public static function log( $msg, $level = 'info' ) {
		$uploads = wp_upload_dir();
		$dir = trailingslashit( $uploads['basedir'] ) . 'kf-logs';
		if ( ! file_exists( $dir ) ) {
			wp_mkdir_p( $dir );
			file_put_contents( $dir . '/.htaccess', "Order deny,allow\nDeny from all\n" );
		}
		$line = sprintf( "[%s][%s] %s\n",
			current_time( 'mysql' ),
			strtoupper( $level ),
			is_string( $msg ) ? $msg : wp_json_encode( $msg )
		);
		@file_put_contents( $dir . '/log.txt', $line, FILE_APPEND );
	}

	public static function tail( $lines = 100 ) {
		$uploads = wp_upload_dir();
		$file = trailingslashit( $uploads['basedir'] ) . 'kf-logs/log.txt';
		if ( ! file_exists( $file ) ) {
			return '';
		}
		$content = file( $file );
		$slice = array_slice( $content, -$lines );
		return implode( '', $slice );
	}
}
