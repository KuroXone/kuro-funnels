<?php
/**
 * Database schema + data access. Six tables:
 *   - kf_customers       : managed customer list (manual + WC sync)
 *   - kf_links           : payment-link pool
 *   - kf_link_log        : every rotated send + click/conversion tracking
 *   - kf_templates       : email templates
 *   - kf_automations     : automation rules (trigger -> template)
 *   - kf_queue           : scheduled outbound emails
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_DB {

	public static function t( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'kf_' . $name;
	}

	public static function create_tables() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();

		$sql_customers = "CREATE TABLE " . self::t( 'customers' ) . " (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			email VARCHAR(191) NOT NULL,
			first_name VARCHAR(120) DEFAULT NULL,
			last_name VARCHAR(120) DEFAULT NULL,
			phone VARCHAR(60) DEFAULT NULL,
			wc_user_id BIGINT UNSIGNED DEFAULT NULL,
			wc_last_order_id BIGINT UNSIGNED DEFAULT NULL,
			lifetime_value DECIMAL(12,2) NOT NULL DEFAULT 0,
			tags VARCHAR(255) DEFAULT NULL,
			source VARCHAR(40) NOT NULL DEFAULT 'manual',
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY email_unique (email),
			KEY status_idx (status),
			KEY wc_user_idx (wc_user_id)
		) $charset;";

		$sql_links = "CREATE TABLE " . self::t( 'links' ) . " (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			label VARCHAR(191) NOT NULL,
			url TEXT NOT NULL,
			provider VARCHAR(40) DEFAULT NULL,
			pool VARCHAR(80) NOT NULL DEFAULT 'default',
			weight INT NOT NULL DEFAULT 1,
			max_uses INT NOT NULL DEFAULT 0,
			usage_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
			active TINYINT(1) NOT NULL DEFAULT 1,
			notes TEXT NULL,
			created_at DATETIME NOT NULL,
			last_used_at DATETIME NULL,
			PRIMARY KEY  (id),
			KEY pool_active (pool, active)
		) $charset;";

		$sql_link_log = "CREATE TABLE " . self::t( 'link_log' ) . " (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			link_id BIGINT UNSIGNED NOT NULL,
			customer_id BIGINT UNSIGNED DEFAULT NULL,
			order_id BIGINT UNSIGNED DEFAULT NULL,
			email VARCHAR(191) DEFAULT NULL,
			token VARCHAR(64) NOT NULL,
			context VARCHAR(60) DEFAULT NULL,
			sent_at DATETIME NOT NULL,
			clicked_at DATETIME NULL,
			converted_at DATETIME NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY token_unique (token),
			KEY link_idx (link_id),
			KEY customer_idx (customer_id)
		) $charset;";

		$sql_templates = "CREATE TABLE " . self::t( 'templates' ) . " (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(191) NOT NULL,
			slug VARCHAR(80) NOT NULL,
			subject VARCHAR(255) NOT NULL,
			heading VARCHAR(255) DEFAULT NULL,
			body LONGTEXT NOT NULL,
			cta_label VARCHAR(80) NOT NULL DEFAULT 'Pay Now',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY slug_unique (slug)
		) $charset;";

		$sql_automations = "CREATE TABLE " . self::t( 'automations' ) . " (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(191) NOT NULL,
			trigger_event VARCHAR(80) NOT NULL,
			template_id BIGINT UNSIGNED NOT NULL,
			link_pool VARCHAR(80) NOT NULL DEFAULT 'default',
			delay_hours INT NOT NULL DEFAULT 0,
			conditions LONGTEXT NULL,
			active TINYINT(1) NOT NULL DEFAULT 1,
			stats_sent BIGINT UNSIGNED NOT NULL DEFAULT 0,
			stats_clicked BIGINT UNSIGNED NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY trigger_active (trigger_event, active)
		) $charset;";

		$sql_queue = "CREATE TABLE " . self::t( 'queue' ) . " (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			automation_id BIGINT UNSIGNED DEFAULT NULL,
			template_id BIGINT UNSIGNED NOT NULL,
			customer_id BIGINT UNSIGNED DEFAULT NULL,
			recipient_email VARCHAR(191) NOT NULL,
			order_id BIGINT UNSIGNED DEFAULT NULL,
			link_pool VARCHAR(80) NOT NULL DEFAULT 'default',
			merge_data LONGTEXT NULL,
			scheduled_at DATETIME NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			attempts INT NOT NULL DEFAULT 0,
			last_error TEXT NULL,
			sent_at DATETIME NULL,
			link_log_id BIGINT UNSIGNED DEFAULT NULL,
			PRIMARY KEY  (id),
			KEY status_sched (status, scheduled_at),
			KEY recipient_idx (recipient_email)
		) $charset;";

		dbDelta( $sql_customers );
		dbDelta( $sql_links );
		dbDelta( $sql_link_log );
		dbDelta( $sql_templates );
		dbDelta( $sql_automations );
		dbDelta( $sql_queue );
	}

	/* -------- Customers -------- */

	public static function upsert_customer( $data ) {
		global $wpdb;
		$email = strtolower( trim( $data['email'] ?? '' ) );
		if ( ! is_email( $email ) ) {
			return false;
		}
		$existing = self::get_customer_by_email( $email );
		$now = current_time( 'mysql' );
		$row = array(
			'email'            => $email,
			'first_name'       => $data['first_name']       ?? ( $existing->first_name       ?? null ),
			'last_name'        => $data['last_name']        ?? ( $existing->last_name        ?? null ),
			'phone'            => $data['phone']            ?? ( $existing->phone            ?? null ),
			'wc_user_id'       => $data['wc_user_id']       ?? ( $existing->wc_user_id       ?? null ),
			'wc_last_order_id' => $data['wc_last_order_id'] ?? ( $existing->wc_last_order_id ?? null ),
			'lifetime_value'   => $data['lifetime_value']   ?? ( $existing->lifetime_value   ?? 0 ),
			'tags'             => $data['tags']             ?? ( $existing->tags             ?? null ),
			'source'           => $data['source']           ?? ( $existing->source           ?? 'manual' ),
			'status'           => $data['status']           ?? ( $existing->status           ?? 'active' ),
			'updated_at'       => $now,
		);
		if ( $existing ) {
			$wpdb->update( self::t( 'customers' ), $row, array( 'id' => $existing->id ) );
			return $existing->id;
		}
		$row['created_at'] = $now;
		$wpdb->insert( self::t( 'customers' ), $row );
		return $wpdb->insert_id;
	}

	public static function get_customer( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM " . self::t( 'customers' ) . " WHERE id = %d", (int) $id ) );
	}
	public static function get_customer_by_email( $email ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM " . self::t( 'customers' ) . " WHERE email = %s", strtolower( $email ) ) );
	}
	public static function delete_customer( $id ) {
		global $wpdb;
		return $wpdb->delete( self::t( 'customers' ), array( 'id' => (int) $id ) );
	}
	public static function list_customers( $args = array() ) {
		global $wpdb;
		$args = wp_parse_args( $args, array( 'search' => '', 'status' => '', 'limit' => 100, 'offset' => 0 ) );
		$sql = "SELECT * FROM " . self::t( 'customers' ) . " WHERE 1=1";
		$params = array();
		if ( $args['search'] ) {
			$like = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$sql .= " AND ( email LIKE %s OR first_name LIKE %s OR last_name LIKE %s )";
			array_push( $params, $like, $like, $like );
		}
		if ( $args['status'] ) {
			$sql .= " AND status = %s";
			$params[] = $args['status'];
		}
		$sql .= " ORDER BY updated_at DESC LIMIT %d OFFSET %d";
		array_push( $params, (int) $args['limit'], (int) $args['offset'] );
		return $wpdb->get_results( $wpdb->prepare( $sql, $params ) );
	}
	public static function count_customers( $status = '' ) {
		global $wpdb;
		if ( $status ) {
			return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM " . self::t( 'customers' ) . " WHERE status = %s", $status ) );
		}
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM " . self::t( 'customers' ) );
	}

	/* -------- Links -------- */

	public static function insert_link( $data ) {
		global $wpdb;
		$data = wp_parse_args( $data, array(
			'label' => '', 'url' => '', 'provider' => null, 'pool' => 'default',
			'weight' => 1, 'max_uses' => 0, 'usage_count' => 0, 'active' => 1, 'notes' => null,
			'created_at' => current_time( 'mysql' ),
		) );
		$wpdb->insert( self::t( 'links' ), $data );
		return $wpdb->insert_id;
	}
	public static function update_link( $id, $data ) { global $wpdb; return $wpdb->update( self::t( 'links' ), $data, array( 'id' => (int) $id ) ); }
	public static function delete_link( $id )        { global $wpdb; return $wpdb->delete( self::t( 'links' ), array( 'id' => (int) $id ) ); }
	public static function get_link( $id )           { global $wpdb; return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM " . self::t( 'links' ) . " WHERE id = %d", (int) $id ) ); }

	public static function eligible_links( $pool = 'default' ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM " . self::t( 'links' ) . "
			 WHERE active = 1 AND pool = %s AND ( max_uses = 0 OR usage_count < max_uses )
			 ORDER BY last_used_at IS NULL DESC, last_used_at ASC, id ASC",
			$pool
		) );
	}
	public static function list_links() { global $wpdb; return $wpdb->get_results( "SELECT * FROM " . self::t( 'links' ) . " ORDER BY id DESC" ); }
	public static function list_pools() {
		global $wpdb;
		return $wpdb->get_col( "SELECT DISTINCT pool FROM " . self::t( 'links' ) . " ORDER BY pool" );
	}

	public static function log_send( $args ) {
		global $wpdb;
		$row = wp_parse_args( $args, array(
			'link_id' => 0, 'customer_id' => null, 'order_id' => null,
			'email' => null, 'token' => '', 'context' => null,
			'sent_at' => current_time( 'mysql' ),
		) );
		$wpdb->insert( self::t( 'link_log' ), $row );
		$id = $wpdb->insert_id;
		$wpdb->query( $wpdb->prepare(
			"UPDATE " . self::t( 'links' ) . " SET usage_count = usage_count + 1, last_used_at = %s WHERE id = %d",
			current_time( 'mysql' ), (int) $row['link_id']
		) );
		return $id;
	}
	public static function get_log_by_token( $token ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM " . self::t( 'link_log' ) . " WHERE token = %s", $token ) );
	}
	public static function mark_clicked( $token ) {
		global $wpdb;
		return $wpdb->query( $wpdb->prepare(
			"UPDATE " . self::t( 'link_log' ) . " SET clicked_at = COALESCE(clicked_at, %s) WHERE token = %s",
			current_time( 'mysql' ), $token
		) );
	}
	public static function recent_sends_link_ids( $email, $hours = 6 ) {
		global $wpdb;
		$since = gmdate( 'Y-m-d H:i:s', time() - $hours * HOUR_IN_SECONDS );
		return array_map( 'intval', $wpdb->get_col( $wpdb->prepare(
			"SELECT link_id FROM " . self::t( 'link_log' ) . " WHERE email = %s AND sent_at >= %s",
			$email, $since
		) ) );
	}
	public static function last_link_id_for_email( $email ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT link_id FROM " . self::t( 'link_log' ) . " WHERE email = %s ORDER BY id DESC LIMIT 1", $email
		) );
	}

	/* -------- Templates -------- */

	public static function insert_template( $data ) {
		global $wpdb;
		$now = current_time( 'mysql' );
		$data = wp_parse_args( $data, array( 'created_at' => $now, 'updated_at' => $now ) );
		$wpdb->insert( self::t( 'templates' ), $data );
		return $wpdb->insert_id;
	}
	public static function update_template( $id, $data ) {
		global $wpdb;
		$data['updated_at'] = current_time( 'mysql' );
		return $wpdb->update( self::t( 'templates' ), $data, array( 'id' => (int) $id ) );
	}
	public static function delete_template( $id ) { global $wpdb; return $wpdb->delete( self::t( 'templates' ), array( 'id' => (int) $id ) ); }
	public static function get_template( $id ) { global $wpdb; return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM " . self::t( 'templates' ) . " WHERE id = %d", (int) $id ) ); }
	public static function get_template_by_slug( $slug ) { global $wpdb; return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM " . self::t( 'templates' ) . " WHERE slug = %s", $slug ) ); }
	public static function list_templates() { global $wpdb; return $wpdb->get_results( "SELECT * FROM " . self::t( 'templates' ) . " ORDER BY name" ); }

	/* -------- Automations -------- */

	public static function insert_automation( $data ) {
		global $wpdb;
		$data = wp_parse_args( $data, array( 'created_at' => current_time( 'mysql' ) ) );
		$wpdb->insert( self::t( 'automations' ), $data );
		return $wpdb->insert_id;
	}
	public static function update_automation( $id, $data ) { global $wpdb; return $wpdb->update( self::t( 'automations' ), $data, array( 'id' => (int) $id ) ); }
	public static function delete_automation( $id )        { global $wpdb; return $wpdb->delete( self::t( 'automations' ), array( 'id' => (int) $id ) ); }
	public static function get_automation( $id )           { global $wpdb; return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM " . self::t( 'automations' ) . " WHERE id = %d", (int) $id ) ); }
	public static function list_automations()              { global $wpdb; return $wpdb->get_results( "SELECT * FROM " . self::t( 'automations' ) . " ORDER BY id DESC" ); }
	public static function automations_for_trigger( $event ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM " . self::t( 'automations' ) . " WHERE active = 1 AND trigger_event = %s", $event
		) );
	}
	public static function bump_automation_stat( $id, $field ) {
		global $wpdb;
		$field = $field === 'stats_clicked' ? 'stats_clicked' : 'stats_sent';
		$wpdb->query( $wpdb->prepare( "UPDATE " . self::t( 'automations' ) . " SET {$field} = {$field} + 1 WHERE id = %d", (int) $id ) );
	}

	/* -------- Queue -------- */

	public static function enqueue( $data ) {
		global $wpdb;
		$data = wp_parse_args( $data, array(
			'automation_id' => null, 'template_id' => 0, 'customer_id' => null,
			'recipient_email' => '', 'order_id' => null, 'link_pool' => 'default',
			'merge_data' => null, 'scheduled_at' => current_time( 'mysql' ),
			'status' => 'pending', 'attempts' => 0,
		) );
		$wpdb->insert( self::t( 'queue' ), $data );
		return $wpdb->insert_id;
	}
	public static function due_queue( $limit = 25 ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM " . self::t( 'queue' ) . " WHERE status = 'pending' AND scheduled_at <= %s ORDER BY scheduled_at ASC LIMIT %d",
			current_time( 'mysql' ), (int) $limit
		) );
	}
	public static function update_queue( $id, $data ) { global $wpdb; return $wpdb->update( self::t( 'queue' ), $data, array( 'id' => (int) $id ) ); }
	public static function list_queue( $limit = 50 ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM " . self::t( 'queue' ) . " ORDER BY id DESC LIMIT %d", (int) $limit ) );
	}
	public static function recent_queue_exists( $template_id, $email, $hours ) {
		global $wpdb;
		$since = gmdate( 'Y-m-d H:i:s', time() - $hours * HOUR_IN_SECONDS );
		return (bool) $wpdb->get_var( $wpdb->prepare(
			"SELECT 1 FROM " . self::t( 'queue' ) . "
			 WHERE template_id = %d AND recipient_email = %s AND scheduled_at >= %s LIMIT 1",
			$template_id, $email, $since
		) );
	}
}
