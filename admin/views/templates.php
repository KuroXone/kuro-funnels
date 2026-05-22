<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$editing = isset( $_GET['edit'] ) ? KF_DB::get_template( (int) $_GET['edit'] ) : null;
$templates = KF_DB::list_templates();
?>
<header class="kf-page-head">
	<div>
		<h1>Email templates</h1>
		<p class="kf-page-sub">Write the message. The system wraps it in a branded frame and injects a single Pay Now button using a rotated link.</p>
	</div>
</header>

<section class="kf-grid-2">
	<div class="kf-card">
		<div class="kf-card-head">
			<h2><?php echo $editing ? 'Edit template' : 'New template'; ?></h2>
		</div>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kf-form">
			<input type="hidden" name="action" value="kf_save_template">
			<?php wp_nonce_field( KF_Admin::NONCE ); ?>
			<input type="hidden" name="id" value="<?php echo esc_attr( $editing->id ?? 0 ); ?>">

			<div class="kf-field-row">
				<label class="kf-field">
					<span>Name *</span>
					<input type="text" name="name" required value="<?php echo esc_attr( $editing->name ?? '' ); ?>">
				</label>
				<label class="kf-field">
					<span>Slug</span>
					<input type="text" name="slug" value="<?php echo esc_attr( $editing->slug ?? '' ); ?>" placeholder="auto from name">
				</label>
			</div>
			<label class="kf-field">
				<span>Subject *</span>
				<input type="text" name="subject" required value="<?php echo esc_attr( $editing->subject ?? '' ); ?>" placeholder="A friendly reminder about order {order_id}">
			</label>
			<label class="kf-field">
				<span>Heading</span>
				<input type="text" name="heading" value="<?php echo esc_attr( $editing->heading ?? '' ); ?>" placeholder="Your order is waiting">
			</label>
			<label class="kf-field">
				<span>Body</span>
				<textarea name="body" rows="10" required><?php echo esc_textarea( $editing->body ?? "Hi {first_name},\n\nWrite your message here. Separate paragraphs with a blank line." ); ?></textarea>
			</label>
			<label class="kf-field">
				<span>Button label</span>
				<input type="text" name="cta_label" value="<?php echo esc_attr( $editing->cta_label ?? 'Pay Now' ); ?>">
			</label>
			<div class="kf-form-actions">
				<button class="kf-btn kf-btn-primary" type="submit">Save template</button>
				<?php if ( $editing ) : ?>
					<a class="kf-btn kf-btn-ghost" href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-templates' ) ); ?>">Cancel</a>
				<?php endif; ?>
			</div>

			<details class="kf-help">
				<summary>Available merge tags</summary>
				<div class="kf-tags">
					<?php foreach ( KF_Templates::MERGE_TAGS as $tag ) : ?>
						<code><?php echo esc_html( $tag ); ?></code>
					<?php endforeach; ?>
				</div>
				<p class="kf-muted">The Pay Now button URL is added automatically — never paste a payment link into the body.</p>
			</details>
		</form>
	</div>

	<div class="kf-card kf-card-flush">
		<div class="kf-card-head">
			<h2>All templates</h2>
		</div>
		<?php if ( empty( $templates ) ) : ?>
			<div class="kf-empty"><p>No templates yet.</p></div>
		<?php else : ?>
			<table class="kf-table kf-table-flush">
				<thead><tr><th>Name</th><th>Slug</th><th>Subject</th><th></th></tr></thead>
				<tbody>
				<?php foreach ( $templates as $t ) : ?>
					<tr>
						<td><div class="kf-cust-name"><?php echo esc_html( $t->name ); ?></div></td>
						<td><span class="kf-pill"><?php echo esc_html( $t->slug ); ?></span></td>
						<td class="kf-muted kf-truncate"><?php echo esc_html( $t->subject ); ?></td>
						<td class="kf-row-actions">
							<a href="<?php echo esc_url( admin_url( 'admin.php?page=kuro-funnels-templates&edit=' . $t->id ) ); ?>">Edit</a>
							<a class="kf-danger" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=kf_delete_template&id=' . $t->id ), KF_Admin::NONCE ) ); ?>" onclick="return confirm('Delete this template?')">Delete</a>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>
</section>
