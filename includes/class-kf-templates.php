<?php
/**
 * Email template handling.
 *  - Wraps the saved body in a clean, mobile-friendly branded frame.
 *  - Merge tags resolved here.
 *  - Seeds default templates on activation (reminder/renewal/follow-up).
 *
 * The frame deliberately shows ONE Pay Now button. The rotated URL is the only
 * link the customer sees — the rotation logic stays entirely on the backend.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class KF_Templates {

	const MERGE_TAGS = array(
		'{first_name}', '{last_name}', '{full_name}', '{email}',
		'{order_id}', '{order_total}', '{order_items}',
		'{site_name}', '{site_url}',
		'{support_email}', '{unsubscribe_url}',
	);

	public static function seed_defaults() {
		$defaults = array(
			array(
				'slug'      => 'payment_reminder',
				'name'      => __( 'Payment reminder', 'kuro-funnels' ),
				'subject'   => __( 'A friendly reminder about your order {order_id}', 'kuro-funnels' ),
				'heading'   => __( 'Your order is waiting', 'kuro-funnels' ),
				'cta_label' => __( 'Complete payment', 'kuro-funnels' ),
				'body'      => "Hi {first_name},\n\nWe noticed your order {order_id} ({order_total}) is still awaiting payment. To secure your items, please complete your payment using the secure link below.\n\nIf you've already paid, you can disregard this message.\n\nThanks,\nThe {site_name} team",
			),
			array(
				'slug'      => 'renewal_offer',
				'name'      => __( 'Renewal offer', 'kuro-funnels' ),
				'subject'   => __( 'Renew your subscription with {site_name}', 'kuro-funnels' ),
				'heading'   => __( 'Time to renew', 'kuro-funnels' ),
				'cta_label' => __( 'Renew now', 'kuro-funnels' ),
				'body'      => "Hi {first_name},\n\nYour subscription with {site_name} is coming up for renewal. Continue uninterrupted access by renewing today.\n\nAs a thank-you for being a loyal customer, your renewal is ready below.",
			),
			array(
				'slug'      => 'order_followup',
				'name'      => __( 'Order follow-up', 'kuro-funnels' ),
				'subject'   => __( 'Thanks for your order — a little something for you', 'kuro-funnels' ),
				'heading'   => __( 'A little something for next time', 'kuro-funnels' ),
				'cta_label' => __( 'Claim your offer', 'kuro-funnels' ),
				'body'      => "Hi {first_name},\n\nThanks again for your recent order with {site_name}. We've put together an exclusive offer just for you — tap below to claim it.",
			),
		);

		foreach ( $defaults as $d ) {
			if ( KF_DB::get_template_by_slug( $d['slug'] ) ) {
				continue;
			}
			KF_DB::insert_template( $d );
		}
	}

	/**
	 * Resolve merge tags. $vars overrides defaults.
	 */
	public static function merge( $text, $vars = array() ) {
		$defaults = array(
			'{site_name}'       => get_bloginfo( 'name' ),
			'{site_url}'        => home_url( '/' ),
			'{support_email}'   => get_option( 'kf_brand_support_email', get_bloginfo( 'admin_email' ) ),
			'{unsubscribe_url}' => '#',
			'{first_name}'      => '',
			'{last_name}'       => '',
			'{full_name}'       => '',
			'{email}'           => '',
			'{order_id}'        => '',
			'{order_total}'     => '',
			'{order_items}'     => '',
		);
		$all = array_merge( $defaults, $vars );
		return strtr( $text, $all );
	}

	/**
	 * Render the final HTML email: branded frame + body + single CTA.
	 *
	 * @param object $template
	 * @param string $cta_url    The rotated, tracked URL
	 * @param array  $vars       Merge data
	 * @return array [ 'subject' => ..., 'html' => ..., 'text' => ... ]
	 */
	public static function render( $template, $cta_url, $vars = array() ) {
		$subject  = self::merge( $template->subject, $vars );
		$heading  = self::merge( $template->heading ?: $template->name, $vars );
		$cta_text = $template->cta_label ?: __( 'Pay Now', 'kuro-funnels' );
		$body_raw = self::merge( $template->body, $vars );

		// Convert newlines to paragraphs, escape user content.
		$paragraphs = array_filter( array_map( 'trim', preg_split( "/\r?\n\r?\n+/", $body_raw ) ) );
		$body_html  = '';
		foreach ( $paragraphs as $p ) {
			$body_html .= '<p style="margin:0 0 16px;line-height:1.6;color:#374151;font-size:15px;">' . nl2br( esc_html( $p ) ) . '</p>';
		}

		$accent       = get_option( 'kf_brand_accent', '#5b46f6' );
		$logo_url     = get_option( 'kf_brand_logo_url' );
		$support      = get_option( 'kf_brand_support_email', get_bloginfo( 'admin_email' ) );
		$site_name    = get_bloginfo( 'name' );
		$year         = gmdate( 'Y' );
		$preheader    = self::merge( $template->subject, $vars );

		$logo_block = $logo_url
			? '<img src="' . esc_url( $logo_url ) . '" alt="' . esc_attr( $site_name ) . '" style="max-height:36px;display:block;">'
			: '<div style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.01em;">' . esc_html( $site_name ) . '</div>';

		$html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . esc_html( $subject ) . '</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' . esc_html( $preheader ) . '</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(17,24,39,0.06);">
      <tr><td style="padding:28px 32px 0 32px;">' . $logo_block . '</td></tr>
      <tr><td style="padding:24px 32px 8px 32px;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;letter-spacing:-0.01em;color:#111827;font-weight:700;">' . esc_html( $heading ) . '</h1>
        ' . $body_html . '
      </td></tr>
      <tr><td style="padding:8px 32px 32px 32px;" align="left">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="' . esc_attr( $accent ) . '" style="border-radius:10px;">
          <a href="' . esc_url( $cta_url ) . '" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;font-family:inherit;">' . esc_html( $cta_text ) . '</a>
        </td></tr></table>
        <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">If the button above doesn\'t work, copy and paste this link into your browser:<br><span style="color:#374151;word-break:break-all;">' . esc_html( $cta_url ) . '</span></p>
      </td></tr>
      <tr><td style="padding:0 32px 28px 32px;border-top:1px solid #f3f4f6;">
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">Questions? Reply to this email or contact <a href="mailto:' . esc_attr( $support ) . '" style="color:' . esc_attr( $accent ) . ';text-decoration:none;">' . esc_html( $support ) . '</a>.</p>
        <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">&copy; ' . esc_html( $year ) . ' ' . esc_html( $site_name ) . '. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>';

		// Plain-text fallback.
		$text = wp_strip_all_tags( $body_raw ) . "\n\n" . $cta_text . ': ' . $cta_url;

		return array(
			'subject' => $subject,
			'html'    => $html,
			'text'    => $text,
		);
	}
}
