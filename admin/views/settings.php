<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<header class="kf-page-head">
	<div>
		<h1>Settings</h1>
		<p class="kf-page-sub">Configure Zoho SMTP, rotation behaviour, branding, and timing.</p>
	</div>
</header>

<section class="kf-grid-2">
	<div class="kf-card">
		<div class="kf-card-head">
			<h2>Zoho SMTP</h2>
		</div>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kf-form">
			<input type="hidden" name="action" value="kf_save_settings">
			<?php wp_nonce_field( KF_Admin::NONCE ); ?>

			<div class="kf-field-row">
				<label class="kf-field">
					<span>Host</span>
					<input type="text" name="smtp_host" value="<?php echo esc_attr( get_option( 'kf_smtp_host', 'smtp.zoho.com' ) ); ?>">
				</label>
				<label class="kf-field">
					<span>Port</span>
					<input type="number" name="smtp_port" value="<?php echo esc_attr( get_option( 'kf_smtp_port', 587 ) ); ?>">
				</label>
				<label class="kf-field">
					<span>Encryption</span>
					<select name="smtp_encryption">
						<?php $e = get_option( 'kf_smtp_encryption', 'tls' ); ?>
						<option value="tls" <?php selected( $e, 'tls' ); ?>>TLS</option>
						<option value="ssl" <?php selected( $e, 'ssl' ); ?>>SSL</option>
						<option value="none" <?php selected( $e, 'none' ); ?>>None</option>
					</select>
				</label>
			</div>
			<label class="kf-field">
				<span>Username</span>
				<input type="text" name="smtp_username" value="<?php echo esc_attr( get_option( 'kf_smtp_username' ) ); ?>">
			</label>
			<label class="kf-field">
				<span>Password <span class="kf-muted">(leave blank to keep current)</span></span>
				<input type="password" name="smtp_password" autocomplete="new-password">
			</label>
			<div class="kf-field-row">
				<label class="kf-field">
					<span>From email</span>
					<input type="email" name="smtp_from_email" value="<?php echo esc_attr( get_option( 'kf_smtp_from_email' ) ); ?>">
				</label>
				<label class="kf-field">
					<span>From name</span>
					<input type="text" name="smtp_from_name" value="<?php echo esc_attr( get_option( 'kf_smtp_from_name', get_bloginfo( 'name' ) ) ); ?>">
				</label>
			</div>

			<h3 class="kf-section-title">Rotation</h3>
			<div class="kf-field-row">
				<label class="kf-field">
					<span>Strategy</span>
					<select name="rotation_strategy">
						<?php $s = get_option( 'kf_rotation_strategy', 'no_repeat' ); ?>
						<option value="no_repeat" <?php selected( $s, 'no_repeat' ); ?>>No-repeat (recommended)</option>
						<option value="round_robin" <?php selected( $s, 'round_robin' ); ?>>Round robin</option>
						<option value="random" <?php selected( $s, 'random' ); ?>>Random</option>
						<option value="weighted" <?php selected( $s, 'weighted' ); ?>>Weighted random</option>
					</select>
				</label>
				<label class="kf-field">
					<span>Cooldown (hours)</span>
					<input type="number" min="0" name="cooldown_hours" value="<?php echo esc_attr( get_option( 'kf_cooldown_hours', 6 ) ); ?>">
				</label>
			</div>

			<h3 class="kf-section-title">Timing</h3>
			<div class="kf-field-row">
				<label class="kf-field">
					<span>1st reminder (hours)</span>
					<input type="number" min="0" name="reminder_first_after" value="<?php echo esc_attr( get_option( 'kf_reminder_first_after', 24 ) ); ?>">
				</label>
				<label class="kf-field">
					<span>2nd reminder (hours)</span>
					<input type="number" min="0" name="reminder_second_after" value="<?php echo esc_attr( get_option( 'kf_reminder_second_after', 72 ) ); ?>">
				</label>
				<label class="kf-field">
					<span>Renewal lead (days)</span>
					<input type="number" min="1" name="renewal_days_before" value="<?php echo esc_attr( get_option( 'kf_renewal_days_before', 7 ) ); ?>">
				</label>
				<label class="kf-field">
					<span>Follow-up (days)</span>
					<input type="number" min="0" name="followup_after_days" value="<?php echo esc_attr( get_option( 'kf_followup_after_days', 14 ) ); ?>">
				</label>
			</div>

			<h3 class="kf-section-title">Branding</h3>
			<div class="kf-field-row">
				<label class="kf-field">
					<span>Accent colour</span>
					<input type="text" name="brand_accent" value="<?php echo esc_attr( get_option( 'kf_brand_accent', '#5b46f6' ) ); ?>" placeholder="#5b46f6">
				</label>
				<label class="kf-field">
					<span>Support email</span>
					<input type="email" name="brand_support_email" value="<?php echo esc_attr( get_option( 'kf_brand_support_email', get_bloginfo( 'admin_email' ) ) ); ?>">
				</label>
			</div>
			<label class="kf-field">
				<span>Logo URL</span>
				<input type="url" name="brand_logo_url" value="<?php echo esc_attr( get_option( 'kf_brand_logo_url' ) ); ?>" placeholder="https://example.com/logo.png">
			</label>

			<div class="kf-form-actions">
				<button class="kf-btn kf-btn-primary" type="submit">Save settings</button>
			</div>
		</form>
	</div>

	<div class="kf-card">
		<div class="kf-card-head">
			<h2>Send a test email</h2>
		</div>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="kf-form">
			<input type="hidden" name="action" value="kf_test_email">
			<?php wp_nonce_field( KF_Admin::NONCE ); ?>
			<label class="kf-field">
				<span>Send to</span>
				<input type="email" name="to" required value="<?php echo esc_attr( wp_get_current_user()->user_email ); ?>">
			</label>
			<div class="kf-form-actions">
				<button class="kf-btn" type="submit">Send test</button>
			</div>
		</form>

		<hr>

		<h3 class="kf-section-title">Zoho cheat-sheet</h3>
		<ul class="kf-info-list">
			<li><code>smtp.zoho.com</code> for global accounts, <code>smtp.zoho.eu</code> for EU.</li>
			<li>Port <strong>587</strong> with TLS, or <strong>465</strong> with SSL.</li>
			<li>Username is your full Zoho email address.</li>
			<li>If 2FA is enabled on Zoho, use an <strong>app-specific password</strong>.</li>
			<li>The "From email" must be verified inside your Zoho account.</li>
		</ul>
	</div>
</section>
