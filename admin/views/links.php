<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$editing = isset( $_GET['edit'] ) ? KF_DB::get_link( (int) $_GET['edit'] ) : null;
$links = KF_DB::list_links();
$pools = KF_DB::list_pools();
?>
<header class="kf-page-head">
	<div>
		<h1>Payment links</h1>
		<p class="kf-page-sub">Group links into pools. The system picks a different one for each email — no repeats until the pool is exhausted.</p>
	</div>
</header>

<section class="kf-grid-2">
	<div class="kf-card">
		<div class="kf-card-head">
			<h2><?php echo $editing ? 'Edit link' : 'Add new link'; ?></h2>
		</div>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kf-form">
			<input type="hidden" name="action" value="kf_save_link">
			<?php wp_nonce_field( KF_Admin::NONCE ); ?>
			<input type="hidden" name="id" value="<?php echo esc_attr( $editing->id ?? 0 ); ?>">

			<label class="kf-field">
				<span>Label *</span>
				<input type="text" name="label" required placeholder="Stripe — Product A" value="<?php echo esc_attr( $editing->label ?? '' ); ?>">
			</label>
			<label class="kf-field">
				<span>URL *</span>
				<input type="url" name="url" required placeholder="https://buy.stripe.com/..." value="<?php echo esc_attr( $editing->url ?? '' ); ?>">
			</label>
			<div class="kf-field-row">
				<label class="kf-field">
					<span>Provider</span>
					<input type="text" name="provider" placeholder="stripe, paypal, square…" value="<?php echo esc_attr( $editing->provider ?? '' ); ?>">
				</label>
				<label class="kf-field">
					<span>Pool</span>
					<input type="text" name="pool" placeholder="default" value="<?php echo esc_attr( $editing->pool ?? 'default' ); ?>">
				</label>
			</div>
			<div class="kf-field-row">
				<label class="kf-field">
					<span>Weight</span>
					<input type="number" min="1" name="weight" value="<?php echo esc_attr( $editing->weight ?? 1 ); ?>">
				</label>
				<label class="kf-field">
					<span>Max uses (0 = unlimited)</span>
					<input type="number" min="0" name="max_uses" value="<?php echo esc_attr( $editing->max_uses ?? 0 ); ?>">
				</label>
			</div>
			<label class="kf-field">
				<span>Notes</span>
				<textarea name="notes" rows="2"><?php echo esc_textarea( $editing->notes ?? '' ); ?></textarea>
			</label>
			<label class="kf-toggle">
				<input type="checkbox" name="active" value="1" <?php checked( ! isset( $editing ) || $editing->active ); ?>>
				<span>Active in rotation</span>
			</label>
			<div class="kf-form-actions">
				<button class="kf-btn kf-btn-primary" type="submit">Save link</button>
				<?php if ( $editing ) : ?>
					<a class="kf-btn kf-btn-ghost" href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-links' ) ); ?>">Cancel</a>
				<?php endif; ?>
			</div>
		</form>
	</div>

	<div class="kf-card kf-card-flush">
		<div class="kf-card-head">
			<h2>Pool overview</h2>
			<?php if ( $pools ) : ?>
				<span class="kf-muted"><?php echo count( $pools ); ?> pool<?php echo count( $pools ) === 1 ? '' : 's'; ?></span>
			<?php endif; ?>
		</div>
		<?php if ( empty( $links ) ) : ?>
			<div class="kf-empty"><p>No links yet — add your first one on the left.</p></div>
		<?php else : ?>
			<table class="kf-table kf-table-flush">
				<thead><tr><th>Label</th><th>Pool</th><th>Provider</th><th>Uses</th><th>State</th><th></th></tr></thead>
				<tbody>
				<?php foreach ( $links as $l ) :
					$cap_reached = $l->max_uses && $l->usage_count >= $l->max_uses;
					$progress = $l->max_uses ? min( 100, round( ( $l->usage_count / $l->max_uses ) * 100 ) ) : 0;
					?>
					<tr class="<?php echo $l->active ? '' : 'kf-row-off'; ?>">
						<td>
							<div class="kf-cust-name"><?php echo esc_html( $l->label ); ?></div>
							<div class="kf-muted kf-truncate"><?php echo esc_html( $l->url ); ?></div>
						</td>
						<td><span class="kf-pill"><?php echo esc_html( $l->pool ); ?></span></td>
						<td class="kf-muted"><?php echo esc_html( $l->provider ?: '—' ); ?></td>
						<td class="kf-mono">
							<?php echo esc_html( $l->usage_count ); ?><?php if ( $l->max_uses ) echo ' / ' . esc_html( $l->max_uses ); ?>
							<?php if ( $l->max_uses ) : ?>
								<div class="kf-progress"><div class="kf-progress-bar" style="width:<?php echo esc_attr( $progress ); ?>%"></div></div>
							<?php endif; ?>
						</td>
						<td>
							<?php if ( ! $l->active ) : ?>
								<span class="kf-status kf-status-paused">paused</span>
							<?php elseif ( $cap_reached ) : ?>
								<span class="kf-status kf-status-unsubscribed">capped</span>
							<?php else : ?>
								<span class="kf-status kf-status-active">in rotation</span>
							<?php endif; ?>
						</td>
						<td class="kf-row-actions">
							<a href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-links&edit=' . $l->id ) ); ?>">Edit</a>
							<a class="kf-danger" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=kf_delete_link&id=' . $l->id ), KF_Admin::NONCE ) ); ?>" onclick="return confirm('Delete this link?')">Delete</a>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>
</section>
