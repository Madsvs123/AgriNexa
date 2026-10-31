from rest_framework.test import APITestCase


class AuthAndTenancySmokeTests(APITestCase):
    """End-to-end smoke of the auth → organization → data chain.

    These paths were all broken at once in the initial import; this guards
    the register → login → org header → tenant-scoped data flow.
    """

    REGISTER = {
        "email": "smoke@agrinexa.test",
        "password": "Harvest!2026-strong",
        "first_name": "Smoke",
        "last_name": "Test",
        "organization_name": "Smoke Test Farms",
    }

    def _register_and_login(self):
        res = self.client.post("/api/auth/register/", self.REGISTER, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        res = self.client.post(
            "/api/auth/login/",
            {"email": self.REGISTER["email"], "password": self.REGISTER["password"]},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertIn("access", body)
        self.assertIn("refresh", body)
        self.assertIn("organizations", body)
        return body

    def _auth(self, body, org_id=None):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {body['access']}",
            HTTP_X_ORGANIZATION_ID=org_id or body["organizations"][0]["id"],
        )

    def test_register_login_and_me(self):
        body = self._register_and_login()
        self._auth(body)
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["email"], self.REGISTER["email"])

    def test_mixed_case_email_login(self):
        self._register_and_login()
        res = self.client.post(
            "/api/auth/login/",
            {"email": "Smoke@Agrinexa.Test", "password": self.REGISTER["password"]},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)

    def test_refresh_flow(self):
        body = self._register_and_login()
        res = self.client.post("/api/auth/refresh/", {"refresh": body["refresh"]}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn("access", res.json())

    def test_organizations_and_settings_action(self):
        body = self._register_and_login()
        self._auth(body)
        res = self.client.get("/api/organizations/")
        self.assertEqual(res.status_code, 200, res.content)
        org_id = res.json()["results"][0]["id"]
        res = self.client.get(f"/api/organizations/{org_id}/settings/")
        self.assertEqual(res.status_code, 200, res.content)

    def test_org_scoped_endpoints_accessible_with_jwt(self):
        body = self._register_and_login()
        self._auth(body)
        for path in ("/api/farms/", "/api/crops/", "/api/sensors/", "/api/tasks/", "/api/dashboard/summary/"):
            res = self.client.get(path)
            self.assertEqual(res.status_code, 200, f"{path}: {res.content}")

    def test_bad_org_header_does_not_500(self):
        body = self._register_and_login()
        self._auth(body, org_id="not-a-uuid")
        res = self.client.get("/api/farms/")
        self.assertIn(res.status_code, (200, 400, 403))

    def test_invitation_token_not_exposed(self):
        body = self._register_and_login()
        self._auth(body)
        roles = self.client.get("/api/roles/").json()["results"]
        res = self.client.post(
            "/api/invitations/",
            {"email": "crew@agrinexa.test", "role": roles[0]["id"]},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertNotIn("token", res.json())

    def test_member_cannot_grant_self_owner(self):
        body = self._register_and_login()
        self._auth(body)
        member = self.client.get("/api/members/").json()["results"][0]
        res = self.client.patch(f"/api/members/{member['id']}/", {"is_owner": True}, format="json")
        # is_owner is read-only: accepted but unchanged, or rejected.
        if res.status_code == 200:
            self.assertEqual(res.json()["is_owner"], member["is_owner"])


class FarmFlowSmokeTests(APITestCase):
    def setUp(self):
        res = self.client.post(
            "/api/auth/register/",
            {
                "email": "farmer2@agrinexa.test",
                "password": "Harvest!2026-strong",
                "first_name": "F",
                "last_name": "Two",
                "organization_name": "Second Org",
            },
            format="json",
        )
        body = self.client.post(
            "/api/auth/login/",
            {"email": "farmer2@agrinexa.test", "password": "Harvest!2026-strong"},
            format="json",
        ).json()
        self.org_id = body["organizations"][0]["id"]
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {body['access']}",
            HTTP_X_ORGANIZATION_ID=self.org_id,
        )

    def test_create_and_list_farm(self):
        res = self.client.post("/api/farms/", {"name": "North Ridge", "code": "NR-01"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        res = self.client.get("/api/farms/")
        self.assertEqual(res.json()["count"], 1)

    def test_cross_tenant_isolation(self):
        self.client.post("/api/farms/", {"name": "Hidden Farm", "code": "HF-01"}, format="json")
        # Second, unrelated organization must not see the first org's farms.
        self.client.credentials()
        self.client.post(
            "/api/auth/register/",
            {
                "email": "outsider@agrinexa.test",
                "password": "Harvest!2026-strong",
                "first_name": "Out",
                "last_name": "Sider",
                "organization_name": "Other Org",
            },
            format="json",
        )
        body = self.client.post(
            "/api/auth/login/",
            {"email": "outsider@agrinexa.test", "password": "Harvest!2026-strong"},
            format="json",
        ).json()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {body['access']}",
            HTTP_X_ORGANIZATION_ID=self.org_id,  # deliberately another org's id
        )
        res = self.client.get("/api/farms/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["count"], 0)
