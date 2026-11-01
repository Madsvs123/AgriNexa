"""Activate the caller's language for the duration of a request."""

from django.utils import translation

from apps.common.i18n import resolve_language


class LanguageMiddleware:
    """Resolve and activate the request language.

    Django's own `LocaleMiddleware` only reads `Accept-Language`, which would
    ignore a signed-in grower's saved preference. This runs after
    `OrganizationMiddleware` so it can reuse the user that middleware already
    decoded from the JWT — `request.user` is still anonymous at this point,
    because DRF authenticates inside the view.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        language, source = resolve_language(request)
        request.LANGUAGE_CODE = language
        request.language_source = source
        translation.activate(language)
        try:
            response = self.get_response(request)
        finally:
            translation.deactivate()
        response.setdefault("Content-Language", language)
        # Responses differ by language, so shared caches must not reuse one for
        # another; the saved preference also varies them by credentials.
        existing = response.get("Vary")
        parts = [p.strip() for p in (existing or "").split(",") if p.strip()]
        for header in ("Accept-Language", "Authorization"):
            if header.lower() not in {p.lower() for p in parts}:
                parts.append(header)
        response["Vary"] = ", ".join(parts)
        return response
