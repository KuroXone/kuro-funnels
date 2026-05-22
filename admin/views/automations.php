<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$editing = isset( $_GET['edit'] ) ? KF_DB::get_automation( (int) $_GET['edit'] ) : null;
$automations = KF_DB::list_automations();
$templates = KF_DB::list_templates();
$pools = KF_DB::list_pools();
$triggers = array(
	'order_pending'             => __( 'Order: pending payment', 'kuro-funnels' ),
	'order_on_hold'             => __( 'Order: on hold', 'kuro-funnels' ),
	'order_failed'              => __( 'Order: failed', 'kuro-funnels' ),
	'order_completed'           => __( 'Order: completed (upsell / thank you)', 'kuro-funnels' ),
	'subscription_renewal_due'  => __( 'Subscription: renewal due', 'kuro-funnels' ),
);
$conditions = $editing && $editing->conditions ? json_decode( $editing->conditions, true ) : array();
?>
<header class="kf-page-head">
	<div>
		<h1>Automations</h1>
		<p class="kf-page-sub">Connect a WooCommerce trigger to a template. The system schedules sends and rotates links automatically.</p>
	</div>
</header>

<section class="kf-grid-2">
	<div class="kf-card">
		<div class="kf-card-head">
			<h2><?php echo $editing ? 'Edit automation' : 'New automation'; ?></h2>
		</div>

		<?php if ( empty( $templates ) ) : ?>
			<div class="kf-empty">
				<p><strong>Create a template first.</strong></p>
				<p class="kf-muted">Automations need a template to send. <a href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-templates' ) ); ?>">Add one →</a></p>
			</div>
		<?php else : ?>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kf-form">
				<input type="hidden" name="action" value="kf_save_automation">
				<?php wp_nonce_field( KF_Admin::NONCE ); ?>
				<input type="hidden" name="id" value="<?php echo esc_attr( $editing->id ?? 0 ); ?>">

				<label class="kf-field">
					<span>Name *</span>
					<input type="text" name="name" required value="<?php echo esc_attr( $editing->name ?? '' ); ?>" placeholder="Abandoned order — 24h reminder">
				</label>
				<label class="kf-field">
					<span>Trigger *</span>
					<select name="trigger_event" required>
						<?php foreach ( $triggers as $k => $label ) : ?>
							<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $editing->trigger_event ?? '', $k ); ?>><?php echo esc_html( $label ); ?></option>
						<?php endforeach; ?>
					</select>
				</label>
				<div class="kf-field-row">
					<label class="kf-field">
						<span>Template *</span>
						<select name="template_id" required>
							<?php foreach ( $templates as $t ) : ?>
								<option value="<?php echo esc_attr( $t->id ); ?>" <?php selected( $editing->template_id ?? '', $t->id ); ?>><?php echo esc_html( $t->name ); ?></option>
							<?php endforeach; ?>
						</select>
					</label>
					<label class="kf-field">
						<span>Link pool</span>
						<input type="text" name="link_pool" value="<?php echo esc_attr( $editing->link_pool ?? 'default' ); ?>" list="kf-pool-list">
						<datalist id="kf-pool-list">
							<?php foreach ( $pools as $p ) : ?>
								<option value="<?php echo esc_attr( $p ); ?>">
							<?php endforeach; ?>
						</datalist>
					</label>
				</div>
				<div class="kf-field-row">
					<label class="kf-field">
						<span>Delay (hours)</span>
						<input type="number" min="0" name="delay_hours" value="<?php echo esc_attr( $editing->delay_hours ?? 0 ); ?>">
					</label>
					<label class="kf-field">
						<span>Min order total</span>
						<input type="number" min="0" step="0.01" name="min_order_total" value="<?php echo esc_attr( $conditions['min_order_total'] ?? '' ); ?>">
					</label>
				</div>
				<label class="kf-toggle">
					<input type="checkbox" name="active" value="1" <?php checked( ! isset( $editing ) || $editing->active ); ?>>
					<span>Active</span>
				</label>
				<div class="kf-form-actions">
					<button class="kf-btn kf-btn-primary" type="submit">Save automation</button>
					<?php if ( $editing ) : ?>
						<a class="kf-btn kf-btn-ghost" href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-automations' ) ); ?>">Cancel</a>
					<?php endif; ?>
				</div>
			</form>
		<?php endif; ?>
	</div>

	<div class="kf-card kf-card-flush">
		<div class="kf-card-head">
			<h2>Active rules</h2>
		</div>
		<?php if ( empty( $automations ) ) : ?>
			<div class="kf-empty"><p>No automations yet.</p></div>
		<?php else : ?>
			<table class="kf-table kf-table-flush">
				<thead><tr><th>Name</th><th>Trigger</th><th>Pool</th><th>Sent / Clicks</th><th>State</th><th></th></tr></thead>
				<tbody>
				<?php foreach ( $automations as $a ) :
					$tpl = $a->template_id ? KF_DB::get_template( (int) $a->template_id ) : null;
					$ctr = $a->stats_sent > 0 ? round( ( $a->stats_clicked / $a->stats_sent ) * 100, 1 ) : 0;
					?>
					<tr class="<?php echo $a->active ? '' : 'kf-row-off'; ?>">
						<td>
							<div class="kf-cust-name"><?php echo esc_html( $a->name ); ?></div>
							<div class="kf-muted"><?php echo esc_html( $tpl ? $tpl->name : '— template missing' ); ?></div>
						</td>
						<td class="kf-muted"><?php echo esc_html( $triggers[ $a->trigger_event ] ?? $a->trigger_event ); ?></td>
						<td><span class="kf-pill"><?php echo esc_html( $a->link_pool ); ?></span></td>
						<td class="kf-mono">
							<?php echo esc_html( number_format_i18n( $a->stats_sent ) ); ?> / <?php echo esc_html( number_format_i18n( $a->stats_clicked ) ); ?>
							<div class="kf-muted"><?php echo esc_html( $ctr ); ?>% CTR</div>
						</td>
						<td>
							<?php if ( $a->active ) : ?>
								<span class="kf-status kf-status-active">running</span>
							<?php else : ?>
								<span class="kf-status kf-status-paused">paused</span>
							<?php endif; ?>
						</td>
						<td class="kf-row-actions">
							<a href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-automations&edit=' . $a->id ) ); ?>">Edit</a>
							<a class="kf-danger" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=kf_delete_automation&id=' . $a->id ), KF_Admin::NONCE ) ); ?>" onclick="return confirm('Delete?')">Delete</a>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>
</section>
