<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$editing = isset( $_GET['edit'] ) ? KF_DB::get_customer( (int) $_GET['edit'] ) : null;
$search  = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : '';
$customers = KF_DB::list_customers( array( 'search' => $search, 'limit' => 100 ) );
$total = KF_DB::count_customers();
?>
<header class="kf-page-head">
	<div>
		<h1>Customers</h1>
		<p class="kf-page-sub"><?php echo esc_html( number_format_i18n( $total ) ); ?> contacts across WooCommerce, WordPress, and manual entries.</p>
	</div>
	<div class="kf-page-actions">
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline-block;">
			<input type="hidden" name="action" value="kf_bulk_sync">
			<?php wp_nonce_field( KF_Admin::NONCE ); ?>
			<button class="kf-btn kf-btn-ghost" type="submit">Sync from WooCommerce</button>
		</form>
	</div>
</header>

<section class="kf-grid-2">
	<div class="kf-card">
		<div class="kf-card-head">
			<h2><?php echo $editing ? 'Edit customer' : 'Add customer'; ?></h2>
		</div>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kf-form">
			<input type="hidden" name="action" value="kf_save_customer">
			<?php wp_nonce_field( KF_Admin::NONCE ); ?>
			<input type="hidden" name="id" value="<?php echo esc_attr( $editing->id ?? 0 ); ?>">

			<label class="kf-field">
				<span>Email *</span>
				<input type="email" name="email" required value="<?php echo esc_attr( $editing->email ?? '' ); ?>">
			</label>
			<div class="kf-field-row">
				<label class="kf-field">
					<span>First name</span>
					<input type="text" name="first_name" value="<?php echo esc_attr( $editing->first_name ?? '' ); ?>">
				</label>
				<label class="kf-field">
					<span>Last name</span>
					<input type="text" name="last_name" value="<?php echo esc_attr( $editing->last_name ?? '' ); ?>">
				</label>
			</div>
			<label class="kf-field">
				<span>Phone</span>
				<input type="text" name="phone" value="<?php echo esc_attr( $editing->phone ?? '' ); ?>">
			</label>
			<label class="kf-field">
				<span>Tags</span>
				<input type="text" name="tags" value="<?php echo esc_attr( $editing->tags ?? '' ); ?>" placeholder="vip, monthly, b2b">
			</label>
			<label class="kf-field">
				<span>Status</span>
				<select name="status">
					<?php foreach ( array( 'active', 'paused', 'unsubscribed' ) as $s ) : ?>
						<option value="<?php echo esc_attr( $s ); ?>" <?php selected( $editing->status ?? '', $s ); ?>><?php echo esc_html( $s ); ?></option>
					<?php endforeach; ?>
				</select>
			</label>
			<div class="kf-form-actions">
				<button class="kf-btn kf-btn-primary" type="submit">Save customer</button>
				<?php if ( $editing ) : ?>
					<a class="kf-btn kf-btn-ghost" href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-customers' ) ); ?>">Cancel</a>
				<?php endif; ?>
			</div>
		</form>

		<hr>

		<h3 class="kf-section-title">CSV import</h3>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data" class="kf-form">
			<input type="hidden" name="action" value="kf_import_csv">
			<?php wp_nonce_field( KF_Admin::NONCE ); ?>
			<p class="kf-muted">Columns: <code>email, first_name, last_name, phone, tags</code></p>
			<input type="file" name="csv" accept=".csv" required>
			<button class="kf-btn" type="submit">Import CSV</button>
		</form>
	</div>

	<div class="kf-card kf-card-flush">
		<div class="kf-card-head">
			<h2>All customers</h2>
			<form method="get" class="kf-search">
				<input type="hidden" name="page" value="kuro-funnels-customers">
				<input type="search" name="q" value="<?php echo esc_attr( $search ); ?>" placeholder="Search email or name…">
				<button class="kf-btn kf-btn-ghost" type="submit">Search</button>
			</form>
		</div>
		<?php if ( empty( $customers ) ) : ?>
			<div class="kf-empty"><p>No customers yet.</p></div>
		<?php else : ?>
			<table class="kf-table kf-table-flush">
				<thead><tr><th>Customer</th><th>Source</th><th>LTV</th><th>Status</th><th></th></tr></thead>
				<tbody>
				<?php foreach ( $customers as $c ) : ?>
					<tr>
						<td>
							<div class="kf-cust-name"><?php echo esc_html( trim( $c->first_name . ' ' . $c->last_name ) ?: '—' ); ?></div>
							<div class="kf-muted kf-truncate"><?php echo esc_html( $c->email ); ?></div>
						</td>
						<td><span class="kf-pill"><?php echo esc_html( $c->source ); ?></span></td>
						<td class="kf-mono"><?php echo esc_html( number_format_i18n( (float) $c->lifetime_value, 2 ) ); ?></td>
						<td><span class="kf-status kf-status-<?php echo esc_attr( $c->status ); ?>"><?php echo esc_html( $c->status ); ?></span></td>
						<td class="kf-row-actions">
							<a href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-customers&edit=' . $c->id ) ); ?>">Edit</a>
							<a class="kf-danger" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=kf_delete_customer&id=' . $c->id ), KF_Admin::NONCE ) ); ?>" onclick="return confirm('Delete this customer?')">Delete</a>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>
</section>
