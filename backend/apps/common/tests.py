from django.test import RequestFactory, SimpleTestCase
from rest_framework.test import APITestCase

from apps.common import i18n


class LanguageResolutionTests(SimpleTestCase):
    def setUp(self):
        self.rf = RequestFactory()

    def test_country_maps_to_language(self):
        for country, expected in [
            ("SA", "ar"), ("eg", "ar"), ("AE", "ar"),
            ("MX", "es"), ("es", "es"), ("AR", "es"),
            ("US", "en"), ("FR", "en"), ("", "en"), (None, "en"),
        ]:
            self.assertEqual(i18n.language_for_country(country), expected, country)

    def test_cdn_header_wins_over_accept_language(self):
        request = self.rf.get("/", HTTP_CF_IPCOUNTRY="SA", HTTP_ACCEPT_LANGUAGE="es-MX,es;q=0.9")
        self.assertEqual(i18n.country_from_request(request), "SA")
        self.assertEqual(i18n.resolve_language(request), ("ar", "country"))

    def test_anonymised_cloudflare_country_ignored(self):
        """Cloudflare sends XX for anonymised clients and T1 for Tor."""
        for value in ("XX", "T1"):
            request = self.rf.get("/", HTTP_CF_IPCOUNTRY=value)
            self.assertIsNone(i18n.country_from_request(request))

    def test_region_subtag_used_when_no_edge_header(self):
        request = self.rf.get("/", HTTP_ACCEPT_LANGUAGE="es-MX,es;q=0.9,en;q=0.8")
        self.assertEqual(i18n.country_from_request(request), "MX")
        self.assertEqual(i18n.resolve_language(request), ("es", "country"))

    def test_accept_language_without_region(self):
        request = self.rf.get("/", HTTP_ACCEPT_LANGUAGE="ar,en;q=0.5")
        self.assertEqual(i18n.resolve_language(request), ("ar", "accept-language"))

    def test_unsupported_language_falls_back_to_english(self):
        request = self.rf.get("/", HTTP_ACCEPT_LANGUAGE="de-DE,de;q=0.9")
        self.assertEqual(i18n.resolve_language(request), ("en", "default"))

    def test_bare_request_defaults_to_english(self):
        self.assertEqual(i18n.resolve_language(self.rf.get("/")), ("en", "default"))

    def test_normalize_language(self):
        self.assertEqual(i18n.normalize_language("ar-EG"), "ar")
        self.assertEqual(i18n.normalize_language("es_MX"), "es")
        self.assertEqual(i18n.normalize_language("EN"), "en")
        self.assertIsNone(i18n.normalize_language("de"))
        self.assertIsNone(i18n.normalize_language(""))
        self.assertIsNone(i18n.normalize_language(None))


class LanguageDetectEndpointTests(APITestCase):
    def test_endpoint_is_public(self):
        res = self.client.get("/api/i18n/detect/")
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body["language"], "en")
        self.assertEqual(body["default"], "en")
        self.assertEqual([s["code"] for s in body["supported"]], ["en", "es", "ar"])

    def test_arabic_country_returns_rtl(self):
        res = self.client.get("/api/i18n/detect/", HTTP_CF_IPCOUNTRY="EG")
        body = res.json()
        self.assertEqual(body["language"], "ar")
        self.assertEqual(body["direction"], "rtl")
        self.assertEqual(body["country"], "EG")
        self.assertEqual(body["source"], "country")

    def test_spanish_country(self):
        body = self.client.get("/api/i18n/detect/", HTTP_CF_IPCOUNTRY="MX").json()
        self.assertEqual((body["language"], body["direction"]), ("es", "ltr"))

    def test_response_is_language_tagged_and_varies(self):
        res = self.client.get("/api/i18n/detect/", HTTP_CF_IPCOUNTRY="SA")
        self.assertEqual(res["Content-Language"], "ar")
        self.assertIn("Accept-Language", res["Vary"])


class ProfileLanguageTests(APITestCase):
    """`preferred_language` drives the API response language, so it must only
    ever hold a code we ship."""

    REG = {
        "email": "lang@agrinexa.test",
        "password": "Harvest!2026-strong",
        "first_name": "Lang",
        "last_name": "Tester",
        "organization_name": "Lang Farms",
    }

    def setUp(self):
        res = self.client.post("/api/auth/register/", self.REG, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        body = self.client.post(
            "/api/auth/login/", {"email": self.REG["email"], "password": self.REG["password"]}, format="json"
        ).json()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {body['access']}",
            HTTP_X_ORGANIZATION_ID=body["organizations"][0]["id"],
        )

    def test_defaults_to_english(self):
        self.assertEqual(self.client.get("/api/auth/profile/").json()["preferred_language"], "en")

    def test_accepts_supported_language_and_normalizes_region(self):
        for sent, stored in [("ar", "ar"), ("es-MX", "es"), ("EN", "en")]:
            res = self.client.patch("/api/auth/profile/", {"preferred_language": sent}, format="json")
            self.assertEqual(res.status_code, 200, res.content)
            self.assertEqual(res.json()["preferred_language"], stored)

    def test_rejects_unsupported_language(self):
        res = self.client.patch("/api/auth/profile/", {"preferred_language": "de"}, format="json")
        self.assertEqual(res.status_code, 400, res.content)

    def test_saved_preference_beats_country_header(self):
        """A grower who chose Spanish keeps Spanish while travelling.

        `/api/i18n/detect/` permits anonymous callers but still honours
        credentials when they are sent, so a signed-in user is told their own
        language rather than the one implied by their current location.
        """
        self.client.patch("/api/auth/profile/", {"preferred_language": "es"}, format="json")
        body = self.client.get("/api/i18n/detect/", HTTP_CF_IPCOUNTRY="SA").json()
        self.assertEqual(body["language"], "es")
        self.assertEqual(body["source"], "profile")
        # The country is still reported, so the UI can offer to switch.
        self.assertEqual(body["country"], "SA")
        res = self.client.get("/api/auth/profile/", HTTP_CF_IPCOUNTRY="SA")
        self.assertEqual(res["Content-Language"], "es")

    def test_anonymous_caller_in_same_country_gets_arabic(self):
        self.client.credentials()
        body = self.client.get("/api/i18n/detect/", HTTP_CF_IPCOUNTRY="SA").json()
        self.assertEqual((body["language"], body["source"]), ("ar", "country"))
