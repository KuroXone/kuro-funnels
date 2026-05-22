<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$templates = KF_DB::list_templates();
$pools = KF_DB::list_pools() ?: array( 'default' );
$active_customers = KF_DB::count_customers( 'active' );
?>
<header class="kf-page-head">
	<div>
		<h1>Broadcast</h1>
		<p class="kf-page-sub">Send a template to your customer list right now. Each recipient gets a unique rotated link.</p>
	</div>
</header>

<section class="kf-grid-2">
	<div class="kf-card">
		<div class="kf-card-head">
			<h2>Compose broadcast</h2>
		</div>
		<?php if ( empty( $templates ) ) : ?>
			<div class="kf-empty">
				<p><strong>Create a template first.</strong></p>
				<p class="kf-muted"><a href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-templates' ) ); ?>">Add template →</a></p>
			</div>
		<?php else : ?>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kf-form">
				<input type="hidden" name="action" value="kf_broadcast">
				<?php wp_nonce_field( KF_Admin::NONCE ); ?>

				<label class="kf-field">
					<span>Template *</span>
					<select name="template_id" required>
						<?php foreach ( $templates as $t ) : ?>
							<option value="<?php echo esc_attr( $t->id ); ?>"><?php echo esc_html( $t->name ); ?></option>
						<?php endforeach; ?>
					</select>
				</label>
				<div class="kf-field-row">
					<label class="kf-field">
						<span>Link pool</span>
						<select name="link_pool">
							<?php foreach ( $pools as $p ) : ?>
								<option value="<?php echo esc_attr( $p ); ?>"><?php echo esc_html( $p ); ?></option>
							<?php endforeach; ?>
						</select>
					</label>
					<label class="kf-field">
						<span>Delay (hours)</span>
						<input type="number" min="0" name="delay_hours" value="0">
					</label>
				</div>
				<div class="kf-field-row">
					<label class="kf-field">
						<span>Limit recipients (0 = all)</span>
						<input type="number" min="0" name="limit" value="0">
					</label>
					<label class="kf-field">
						<span>Tag filter</span>
						<input type="text" name="tag_filter" placeholder="vip">
					</label>
				</div>
				<div class="kf-form-actions">
					<button class="kf-btn kf-btn-primary" type="submit" onclick="return confirm('Queue this broadcast to your customer list?')">Queue broadcast</button>
				</div>
			</form>
		<?php endif; ?>
	</div>

	<div class="kf-card">
		<div class="kf-card-head">
			<h2>What happens</h2>
		</div>
		<ul class="kf-info-list">
			<li><strong><?php echo esc_html( number_format_i18n( $active_customers ) ); ?></strong> active customers will be queued.</li>
			<li>Each gets a fresh link from the chosen pool — no two consecutive sends share a link.</li>
			<li>Cooldown prevents the same template hitting the same person twice within <strong><?php echo esc_html( get_option( 'kf_cooldown_hours', 6 ) ); ?> hours</strong>.</li>
			<li>The queue is drained every 15 minutes by WordPress cron, plus an inline tick whenever you load an admin page.</li>
		</ul>
	</div>
</section>

<section class="kf-card">
	<div class="kf-card-head">
		<h2>Recent queue items</h2>
	</div>
	<?php $rows = KF_DB::list_queue( 20 ); ?>
	<?php if ( empty( $rows ) ) : ?>
		<div class="kf-empty"><p>Queue is empty.</p></div>
	<?php else : ?>
		<table class="kf-table">
			<thead><tr><th>Recipient</th><th>Template</th><th>Pool</th><th>Scheduled</th><th>Status</th></tr></thead>
			<tbody>
			<?php foreach ( $rows as $row ) :
				$tpl = KF_DB::get_template( (int) $row->template_id );
				?>
				<tr>
					<td><?php echo esc_html( $row->recipient_email ); ?></td>
					<td><?php echo esc_html( $tpl ? $tpl->name : '—' ); ?></td>
					<td><span class="kf-pill"><?php echo esc_html( $row->link_pool ); ?></span></td>
					<td class="kf-mono"><?php echo esc_html( mysql2date( 'M j, H:i', $row->scheduled_at ) ); ?></td>
					<td><span class="kf-status kf-status-<?php echo esc_attr( $row->status === 'sent' ? 'active' : ( $row->status === 'failed' ? 'unsubscribed' : 'paused' ) ); ?>"><?php echo esc_html( $row->status ); ?></span></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>
	<?php endif; ?>
</section>
