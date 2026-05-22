<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

global $wpdb;
$customer_count = KF_DB::count_customers();
$active_links   = (int) $wpdb->get_var( "SELECT COUNT(*) FROM " . KF_DB::t( 'links' ) . " WHERE active = 1" );
$total_links    = (int) $wpdb->get_var( "SELECT COUNT(*) FROM " . KF_DB::t( 'links' ) );
$templates      = (int) $wpdb->get_var( "SELECT COUNT(*) FROM " . KF_DB::t( 'templates' ) );
$active_autos   = (int) $wpdb->get_var( "SELECT COUNT(*) FROM " . KF_DB::t( 'automations' ) . " WHERE active = 1" );
$pending_queue  = (int) $wpdb->get_var( "SELECT COUNT(*) FROM " . KF_DB::t( 'queue' ) . " WHERE status = 'pending'" );
$sent_7d        = (int) $wpdb->get_var( $wpdb->prepare(
	"SELECT COUNT(*) FROM " . KF_DB::t( 'queue' ) . " WHERE status = 'sent' AND sent_at >= %s",
	gmdate( 'Y-m-d 00:00:00', time() - 7 * DAY_IN_SECONDS )
) );
$clicks_7d = (int) $wpdb->get_var( $wpdb->prepare(
	"SELECT COUNT(*) FROM " . KF_DB::t( 'link_log' ) . " WHERE clicked_at >= %s",
	gmdate( 'Y-m-d 00:00:00', time() - 7 * DAY_IN_SECONDS )
) );

$recent_log = $wpdb->get_results(
	"SELECT ll.sent_at, ll.email, ll.context, ll.clicked_at, l.label
	 FROM " . KF_DB::t( 'link_log' ) . " ll
	 LEFT JOIN " . KF_DB::t( 'links' ) . " l ON l.id = ll.link_id
	 ORDER BY ll.id DESC LIMIT 12"
);

$ctr = $sent_7d > 0 ? round( ( $clicks_7d / $sent_7d ) * 100, 1 ) : 0;
?>
<header class="kf-page-head">
	<div>
		<h1>Dashboard</h1>
		<p class="kf-page-sub">Overview of your funnels, links, and email performance.</p>
	</div>
</header>

<section class="kf-kpis">
	<div class="kf-kpi">
		<div class="kf-kpi-label">Customers</div>
		<div class="kf-kpi-value"><?php echo esc_html( number_format_i18n( $customer_count ) ); ?></div>
		<div class="kf-kpi-foot">Managed list</div>
	</div>
	<div class="kf-kpi">
		<div class="kf-kpi-label">Active links</div>
		<div class="kf-kpi-value"><?php echo esc_html( $active_links ); ?> <span class="kf-kpi-sub">/ <?php echo esc_html( $total_links ); ?></span></div>
		<div class="kf-kpi-foot">In rotation</div>
	</div>
	<div class="kf-kpi">
		<div class="kf-kpi-label">Automations</div>
		<div class="kf-kpi-value"><?php echo esc_html( $active_autos ); ?></div>
		<div class="kf-kpi-foot">Running</div>
	</div>
	<div class="kf-kpi">
		<div class="kf-kpi-label">Templates</div>
		<div class="kf-kpi-value"><?php echo esc_html( $templates ); ?></div>
		<div class="kf-kpi-foot">Configured</div>
	</div>
	<div class="kf-kpi">
		<div class="kf-kpi-label">Sent (7d)</div>
		<div class="kf-kpi-value"><?php echo esc_html( $sent_7d ); ?></div>
		<div class="kf-kpi-foot"><?php echo esc_html( $pending_queue ); ?> in queue</div>
	</div>
	<div class="kf-kpi kf-kpi-accent">
		<div class="kf-kpi-label">CTR (7d)</div>
		<div class="kf-kpi-value"><?php echo esc_html( $ctr ); ?>%</div>
		<div class="kf-kpi-foot"><?php echo esc_html( $clicks_7d ); ?> clicks</div>
	</div>
</section>

<section class="kf-grid-2">
	<div class="kf-card">
		<div class="kf-card-head">
			<h2>Recent rotations</h2>
			<span class="kf-muted">Last 12 sends</span>
		</div>
		<?php if ( empty( $recent_log ) ) : ?>
			<div class="kf-empty">
				<p>No sends yet.</p>
				<p class="kf-muted">Add payment links, create a template, and turn on an automation to get started.</p>
			</div>
		<?php else : ?>
			<table class="kf-table">
				<thead><tr><th>Sent</th><th>Recipient</th><th>Link</th><th>Source</th><th>Click</th></tr></thead>
				<tbody>
				<?php foreach ( $recent_log as $r ) : ?>
					<tr>
						<td class="kf-mono"><?php echo esc_html( mysql2date( 'M j, H:i', $r->sent_at ) ); ?></td>
						<td><?php echo esc_html( $r->email ); ?></td>
						<td><span class="kf-pill"><?php echo esc_html( $r->label ); ?></span></td>
						<td class="kf-muted"><?php echo esc_html( $r->context ); ?></td>
						<td>
							<?php if ( $r->clicked_at ) : ?>
								<span class="kf-dot kf-dot-ok"></span>
							<?php else : ?>
								<span class="kf-dot"></span>
							<?php endif; ?>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>

	<div class="kf-card">
		<div class="kf-card-head">
			<h2>Quick setup</h2>
		</div>
		<ol class="kf-steps">
			<li>
				<strong>Connect Zoho SMTP</strong>
				<p>Add your Zoho host, port, and credentials, then send a test email.</p>
				<a class="kf-btn kf-btn-ghost" href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-settings' ) ); ?>">Open settings</a>
			</li>
			<li>
				<strong>Add payment links to a pool</strong>
				<p>Paste 2 or more Stripe / PayPal / custom URLs into the default pool.</p>
				<a class="kf-btn kf-btn-ghost" href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-links' ) ); ?>">Manage links</a>
			</li>
			<li>
				<strong>Sync your customers</strong>
				<p>Pull existing WooCommerce customers and WordPress users into your list.</p>
				<a class="kf-btn kf-btn-ghost" href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-customers' ) ); ?>">View customers</a>
			</li>
			<li>
				<strong>Activate an automation</strong>
				<p>Pick a trigger, choose a template, and watch the queue fill up.</p>
				<a class="kf-btn kf-btn-primary" href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-automations' ) ); ?>">Create automation</a>
			</li>
		</ol>
	</div>
</section>
