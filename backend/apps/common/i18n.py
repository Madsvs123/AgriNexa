"""Language resolution shared by the API and the SPA.

The country-to-language map here is the authority; the frontend keeps a copy
for the offline time-zone fallback, and `test_country_language_map_matches_frontend`
asserts the two cannot drift.
"""

from django.conf import settings

DEFAULT_LANGUAGE = "en"
SUPPORTED_LANGUAGES = ("en", "es", "ar")
RTL_LANGUAGES = frozenset({"ar"})

# Arab League members whose working business language is Arabic.
ARABIC_COUNTRIES = frozenset(
    {
        "AE", "BH", "DZ", "EG", "IQ", "JO", "KW", "LB", "LY", "MA", "MR",
        "OM", "PS", "QA", "SA", "SD", "SY", "TN", "YE",
    }
)

SPANISH_COUNTRIES = frozenset(
    {
        "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "ES", "GQ", "GT",
        "HN", "MX", "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE",
    }
)

# Country headers injected by common CDNs and platform edges, in the order we
# trust them. Falls through to Accept-Language when none are present.
COUNTRY_HEADERS = (
    "HTTP_CF_IPCOUNTRY",          # Cloudflare
    "HTTP_CLOUDFRONT_VIEWER_COUNTRY",
    "HTTP_X_VERCEL_IP_COUNTRY",
    "HTTP_X_APPENGINE_COUNTRY",
    "HTTP_X_COUNTRY_CODE",        # generic / self-hosted proxies
)


def language_for_country(country):
    """Map an ISO 3166-1 alpha-2 country to one of our languages."""
    if not country:
        return DEFAULT_LANGUAGE
    code = country.strip().upper()
    if code in ARABIC_COUNTRIES:
        return "ar"
    if code in SPANISH_COUNTRIES:
        return "es"
    return DEFAULT_LANGUAGE


def country_from_request(request):
    """Best-effort country for the caller, or None.

    Deliberately avoids a GeoIP database: the CDN already knows the country in
    production, and the SPA falls back to the device time zone otherwise. That
    keeps deployment free of a MaxMind account and a refreshed .mmdb file.
    """
    for header in COUNTRY_HEADERS:
        value = (request.META.get(header) or "").strip().upper()
        # Cloudflare sends XX for anonymised clients and T1 for Tor.
        if len(value) == 2 and value.isalpha() and value not in {"XX", "T1"}:
            return value

    # `Accept-Language: es-MX,es;q=0.9` carries a region subtag often enough to
    # be worth reading when no edge header exists.
    for chunk in (request.META.get("HTTP_ACCEPT_LANGUAGE") or "").split(","):
        tag = chunk.split(";")[0].strip()
        parts = tag.replace("_", "-").split("-")
        if len(parts) >= 2 and len(parts[-1]) == 2 and parts[-1].isalpha():
            return parts[-1].upper()
    return None


def language_from_accept_header(request):
    """First supported language named in Accept-Language, or None."""
    for chunk in (request.META.get("HTTP_ACCEPT_LANGUAGE") or "").split(","):
        tag = chunk.split(";")[0].strip().replace("_", "-").lower()
        base = tag.split("-")[0]
        if base in SUPPORTED_LANGUAGES:
            return base
    return None


def normalize_language(value):
    """Coerce anything user-supplied to a language we actually ship."""
    if not value:
        return None
    base = str(value).strip().replace("_", "-").split("-")[0].lower()
    return base if base in SUPPORTED_LANGUAGES else None


def resolve_language(request):
    """Language for a request, with the source that decided it.

    Order: the signed-in user's saved preference, then the country the edge
    reports, then Accept-Language, then English.
    """
    user = getattr(request, "auth_user", None) or getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        profile = getattr(user, "farmer_profile", None)
        preferred = normalize_language(getattr(profile, "preferred_language", None))
        if preferred:
            return preferred, "profile"

    country = country_from_request(request)
    if country:
        language = language_for_country(country)
        if language != DEFAULT_LANGUAGE:
            return language, "country"

    from_header = language_from_accept_header(request)
    if from_header:
        return from_header, "accept-language"

    return DEFAULT_LANGUAGE, "default"


def language_payload(request):
    """Response body for the public detection endpoint."""
    language, source = resolve_language(request)
    country = country_from_request(request)
    return {
        "language": language,
        "country": country,
        "source": source,
        "direction": "rtl" if language in RTL_LANGUAGES else "ltr",
        "supported": [
            {"code": code, "direction": "rtl" if code in RTL_LANGUAGES else "ltr"}
            for code in SUPPORTED_LANGUAGES
        ],
        "default": DEFAULT_LANGUAGE,
        "fallback_country_source": not country,
        "languages_available": list(dict(settings.LANGUAGES)) if hasattr(settings, "LANGUAGES") else [],
    }
