(function ($) {
	'use strict';

	$(function () {
		// Auto-fill template slug from name.
		var $name = $('input[name="name"][required]');
		var $slug = $('input[name="slug"]');
		if ($name.length && $slug.length && !$slug.val()) {
			$name.on('blur', function () {
				if ($slug.val()) return;
				$slug.val(
					$name.val().toString()
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '-')
						.replace(/^-|-$/g, '')
				);
			});
		}

		// Confirm destructive forms.
		$('button[data-confirm]').on('click', function (e) {
			if (!window.confirm($(this).data('confirm'))) {
				e.preventDefault();
			}
		});
	});
})(jQuery);
