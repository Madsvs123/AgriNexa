from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.equipment.models import Equipment
from apps.farms.models import Farm, Field
from apps.inventory.models import InventoryItem
from apps.tenancy.models import FarmAccess, Membership, Organization, Role

User = get_user_model()


class SearchViewTests(APITestCase):
    """Global search backs the command palette, so it is both a navigation
    surface and an org/farm boundary. These cover both halves."""

    OWNER = {
        "email": "owner@agrinexa.test",
        "password": "Harvest!2026-strong",
        "first_name": "Owner",
        "last_name": "Grower",
        "organization_name": "Northwood Farms",
    }

    def setUp(self):
        res = self.client.post("/api/auth/register/", self.OWNER, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.org = Organization.objects.get(name=self.OWNER["organization_name"])
        self.owner = User.objects.get(email=self.OWNER["email"])

        self.north = Farm.objects.create(organization=self.org, name="North Ridge", code="NR-1")
        self.willow = Farm.objects.create(organization=self.org, name="Willow Creek", code="WC-2")
        self.north_field = Field.objects.create(farm=self.north, name="North 80", code="N80")
        self.willow_field = Field.objects.create(farm=self.willow, name="Willow Bottom", code="WB1")
        Equipment.objects.create(farm=self.north, name="Planter 12", serial="SN-ROW-9921")
        InventoryItem.objects.create(organization=self.org, name="MAP 11-52-0", sku="MAP-1152")

    def _login(self, email, password):
        res = self.client.post("/api/auth/login/", {"email": email, "password": password}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {body['access']}",
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
        )

    def _login_owner(self):
        self._login(self.OWNER["email"], self.OWNER["password"])

    def _make_scout(self, farms):
        """A member restricted to `farms` by explicit FarmAccess grants."""
        scout = User.objects.create_user(
            email="scout@agrinexa.test", password="Scouting!2026-strong"
        )
        role = Role.objects.create(organization=self.org, name="Scout", permissions=["farms.view"])
        Membership.objects.create(user=scout, organization=self.org, role=role, is_owner=False)
        for farm in farms:
            FarmAccess.objects.create(user=scout, farm=farm, can_view=True)
        return scout

    def test_empty_query_returns_all_groups(self):
        self._login_owner()
        res = self.client.get("/api/search/", {"q": ""})
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        for group in ("farms", "fields", "equipment", "inventory", "tasks", "crops"):
            self.assertEqual(body[group], [])
        self.assertEqual(body["counts"]["farms"], 0)

    def test_finds_records_across_groups(self):
        self._login_owner()
        res = self.client.get("/api/search/", {"q": "north"})
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual([f["name"] for f in body["farms"]], ["North Ridge"])
        self.assertEqual([f["name"] for f in body["fields"]], ["North 80"])
        self.assertEqual(body["fields"][0]["farm_name"], "North Ridge")

    def test_matches_identifier_fields(self):
        """Farm code, field code, equipment serial, and inventory SKU are all
        things a user reads off a tag and types in — not just names."""
        self._login_owner()
        for query, group, expected in (
            ("NR-1", "farms", "North Ridge"),
            ("N80", "fields", "North 80"),
            ("SN-ROW-9921", "equipment", "Planter 12"),
            ("MAP-1152", "inventory", "MAP 11-52-0"),
        ):
            res = self.client.get("/api/search/", {"q": query})
            self.assertEqual(res.status_code, 200, res.content)
            names = [r["name"] for r in res.json()[group]]
            self.assertIn(expected, names, f"{query} should match {expected}")

    def test_prefix_matches_rank_above_substring_matches(self):
        Farm.objects.create(organization=self.org, name="Far North Pasture", code="FN-3")
        self._login_owner()
        res = self.client.get("/api/search/", {"q": "north"})
        names = [f["name"] for f in res.json()["farms"]]
        self.assertEqual(names[0], "North Ridge", names)

    def test_type_parameter_limits_groups(self):
        self._login_owner()
        res = self.client.get("/api/search/", {"q": "north", "type": "farms"})
        body = res.json()
        self.assertEqual(len(body["farms"]), 1)
        self.assertEqual(body["fields"], [])

    def test_limit_is_capped(self):
        for i in range(30):
            Farm.objects.create(organization=self.org, name=f"Block {i:02d}")
        self._login_owner()
        res = self.client.get("/api/search/", {"q": "Block", "limit": "500"})
        self.assertEqual(len(res.json()["farms"]), 25)

    def test_restricted_member_cannot_see_other_farms(self):
        """Regression: search used to filter on organization only, leaking the
        names of farms, fields, and equipment a scout had no grant for."""
        self._make_scout([self.north])
        self._login("scout@agrinexa.test", "Scouting!2026-strong")

        res = self.client.get("/api/search/", {"q": "willow"})
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body["farms"], [])
        self.assertEqual(body["fields"], [])

        res = self.client.get("/api/search/", {"q": "north"})
        body = res.json()
        self.assertEqual([f["name"] for f in body["farms"]], ["North Ridge"])
        self.assertEqual([f["name"] for f in body["fields"]], ["North 80"])

    def test_restricted_member_still_sees_org_wide_inventory(self):
        """Stock with no farm is org-wide and must stay visible, matching
        OrganizationQuerySetMixin.filter_by_farm_access."""
        self._make_scout([self.north])
        self._login("scout@agrinexa.test", "Scouting!2026-strong")
        res = self.client.get("/api/search/", {"q": "MAP"})
        self.assertEqual([i["name"] for i in res.json()["inventory"]], ["MAP 11-52-0"])

    def test_owner_sees_everything(self):
        self._login_owner()
        res = self.client.get("/api/search/", {"q": "willow"})
        self.assertEqual([f["name"] for f in res.json()["farms"]], ["Willow Creek"])

    def test_requires_authentication(self):
        self.client.credentials()
        res = self.client.get("/api/search/", {"q": "north"})
        self.assertIn(res.status_code, (401, 403))
