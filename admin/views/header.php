<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$current = isset( $_GET['page'] ) ? sanitize_key( $_GET['page'] ) : 'kuro-funnels';
$nav = array(
	'kuro-funnels'             => array( __( 'Dashboard', 'kuro-funnels' ),     'dashboard' ),
	'kuro-funnels-customers'   => array( __( 'Customers', 'kuro-funnels' ),     'users' ),
	'kuro-funnels-links'       => array( __( 'Payment links', 'kuro-funnels' ), 'link' ),
	'kuro-funnels-templates'   => array( __( 'Email templates', 'kuro-funnels' ),'mail' ),
	'kuro-funnels-automations' => array( __( 'Automations', 'kuro-funnels' ),   'zap' ),
	'kuro-funnels-broadcast'   => array( __( 'Broadcast', 'kuro-funnels' ),     'send' ),
	'kuro-funnels-settings'    => array( __( 'Settings', 'kuro-funnels' ),      'settings' ),
);

// Build a tiny inline SVG sprite for nav icons.
$icons = array(
	'dashboard' => '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
	'users'     => '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2.5"/><path d="M15 14c2.8 0 5 2.2 5 5"/>',
	'link'      => '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5"/>',
	'mail'      => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/>',
	'zap'       => '<path d="M13 2L4 14h7l-1 8 10-13h-7l1-7z"/>',
	'send'      => '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
	'settings'  => '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
);
?>
<div class="kf-app">
	<aside class="kf-sidebar">
		<div class="kf-brand">
			<div class="kf-brand-mark">
				<svg viewBox="0 0 32 32" width="32" height="32"><defs><linearGradient id="kfg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#kfg)"/><path d="M9 9h3v6.5L17.5 9H21l-6 7 6.5 7H18l-5.5-6V23H9z" fill="#fff"/></svg>
			</div>
			<div class="kf-brand-text">
				<span class="kf-brand-name">Kuro Funnels</span>
				<span class="kf-brand-tag">by Kuro X</span>
			</div>
		</div>

		<nav class="kf-nav">
			<?php foreach ( $nav as $slug => $item ) :
				$active = $current === $slug ? ' kf-nav-active' : '';
				?>
				<a class="kf-nav-item<?php echo esc_attr( $active ); ?>" href="<?php echo esc_url( admin_url( 'admin.php?page=' . $slug ) ); ?>">
					<svg class="kf-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><?php echo $icons[ $item[1] ]; ?></svg>
					<span><?php echo esc_html( $item[0] ); ?></span>
				</a>
			<?php endforeach; ?>
		</nav>

		<div class="kf-sidebar-footer">
			<div class="kf-version">v<?php echo esc_html( KF_VERSION ); ?></div>
			<div class="kf-credit">Crafted by <strong>Kuro X</strong></div>
		</div>
	</aside>

	<main class="kf-main">
		<?php
		// Render a top notice for ?msg= flash messages.
		if ( isset( $_GET['msg'] ) ) {
			$messages = array(
				'saved'         => array( 'success', __( 'Saved successfully.', 'kuro-funnels' ) ),
				'deleted'       => array( 'success', __( 'Deleted.', 'kuro-funnels' ) ),
				'imported'      => array( 'success', sprintf( __( 'Imported %d customers.', 'kuro-funnels' ), (int) ( $_GET['count'] ?? 0 ) ) ),
				'import_failed' => array( 'error',   __( 'Import failed — check the CSV format.', 'kuro-funnels' ) ),
				'synced'        => array( 'success', sprintf( __( 'Synced %d records from WordPress & WooCommerce.', 'kuro-funnels' ), (int) ( $_GET['count'] ?? 0 ) ) ),
				'queued'        => array( 'success', sprintf( __( 'Queued %d emails.', 'kuro-funnels' ), (int) ( $_GET['count'] ?? 0 ) ) ),
				'test_ok'       => array( 'success', __( 'Test email sent.', 'kuro-funnels' ) ),
				'test_failed'   => array( 'error',   __( 'Test failed. Verify SMTP credentials.', 'kuro-funnels' ) ),
			);
			$key = sanitize_key( $_GET['msg'] );
			if ( isset( $messages[ $key ] ) ) {
				printf(
					'<div class="kf-flash kf-flash-%s">%s</div>',
					esc_attr( $messages[ $key ][0] ),
					esc_html( $messages[ $key ][1] )
				);
			}
		}
		?>
