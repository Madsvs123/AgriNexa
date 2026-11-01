from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.crops import services
from apps.crops.models import (
    Crop,
    CropPlan,
    CropVariety,
    FarmingStrategy,
    GrowingSeason,
    PlantingWindow,
    ResourceConstraint,
    RotationPlan,
    RotationStep,
    StrategyAllocation,
)
from apps.farms.models import CropHistory, Farm, Field
from apps.tenancy.models import FarmAccess, Membership, Organization, Role

User = get_user_model()


class PlanningFixtureMixin:
    """An org with two fields, three crops with economics, and a season."""

    OWNER = {
        "email": "planner@agrinexa.test",
        "password": "Harvest!2026-strong",
        "first_name": "Plan",
        "last_name": "Ner",
        "organization_name": "Planning Farms",
    }

    def setUp(self):
        res = self.client.post("/api/auth/register/", self.OWNER, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.org = Organization.objects.get(name=self.OWNER["organization_name"])
        self.owner = User.objects.get(email=self.OWNER["email"])
        self.farm = Farm.objects.create(organization=self.org, name="North Ridge", code="NR")
        self.f1 = Field.objects.create(farm=self.farm, name="North 80", acres=80, soil_type="silt loam", irrigation_type="pivot")
        self.f2 = Field.objects.create(farm=self.farm, name="Dry Flat", acres=40, soil_type="sandy loam", irrigation_type="none")
        self.season = GrowingSeason.objects.create(
            organization=self.org, name="2026", start_date=date(2026, 3, 1), end_date=date(2026, 11, 30)
        )
        self.corn = Crop.objects.create(
            organization=self.org, name="Corn", category="grain", family="Poaceae", typical_days=115,
            water_need="high", water_acre_inches=24, labor_hours_per_acre=3, nitrogen_lb_per_acre=180,
            expected_yield_per_acre=200, yield_unit="bu", expected_price_per_unit=Decimal("4.50"),
            seed_cost_per_acre=110, input_cost_per_acre=300,
        )
        self.soy = Crop.objects.create(
            organization=self.org, name="Soybean", category="legume", family="Fabaceae", typical_days=105,
            nitrogen_fixing=True, water_need="medium", water_acre_inches=18, labor_hours_per_acre=2,
            expected_yield_per_acre=60, yield_unit="bu", expected_price_per_unit=Decimal("11"),
            seed_cost_per_acre=60, input_cost_per_acre=150,
        )
        self.pea = Crop.objects.create(
            organization=self.org, name="Field Pea", category="legume", family="Fabaceae", typical_days=90,
            nitrogen_fixing=True, water_need="low", expected_yield_per_acre=38, expected_price_per_unit=Decimal("9"),
            seed_cost_per_acre=48, input_cost_per_acre=95,
        )
        self.corn_full = CropVariety.objects.create(
            crop=self.corn, name="Full Season", days_to_maturity=125, drought_tolerance=2,
            expected_yield_per_acre=220, suitable_soils=["silty clay loam"],
        )
        self.corn_early = CropVariety.objects.create(
            crop=self.corn, name="Early", days_to_maturity=105, drought_tolerance=4,
            expected_yield_per_acre=195, suitable_soils=["silt loam", "sandy loam"], disease_resistance=["GLS"],
        )
        PlantingWindow.objects.create(
            organization=self.org, crop=self.corn, start_month=4, start_day=20, end_month=5, end_day=15,
            late_end_month=6, late_end_day=5, harvest_by_month=10, harvest_by_day=25,
        )
        self._login()

    def _login(self):
        res = self.client.post(
            "/api/auth/login/", {"email": self.OWNER["email"], "password": self.OWNER["password"]}, format="json"
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {res.json()['access']}", HTTP_X_ORGANIZATION_ID=str(self.org.id)
        )


class PlantingWindowTests(PlanningFixtureMixin, APITestCase):
    def test_window_resolves_and_grades_dates(self):
        optimal = services.assess_planting(self.f1, self.corn, None, date(2026, 5, 1), self.season)
        late = services.assess_planting(self.f1, self.corn, None, date(2026, 5, 25), self.season)
        outside = services.assess_planting(self.f1, self.corn, None, date(2026, 6, 20), self.season)
        early = services.assess_planting(self.f1, self.corn, None, date(2026, 4, 1), self.season)
        self.assertEqual(optimal["fit"], "optimal")
        self.assertEqual(late["fit"], "late")
        self.assertEqual(outside["fit"], "outside")
        self.assertEqual(early["fit"], "early")
        self.assertTrue(optimal["window"]["defined"])
        self.assertEqual(optimal["projected_harvest"], "2026-08-24")

    def test_harvest_deadline_flags_slow_variety(self):
        a = services.assess_planting(self.f1, self.corn, self.corn_full, date(2026, 7, 1), self.season)
        self.assertFalse(a["harvest_ok"])
        self.assertTrue(any("harvest-by" in w for w in a["warnings"]))

    def test_category_default_when_no_window_defined(self):
        a = services.assess_planting(self.f1, self.soy, None, date(2026, 5, 10), self.season)
        self.assertFalse(a["window"]["defined"])
        self.assertEqual(a["window"]["source"], "category default")

    def test_variety_specific_window_wins(self):
        PlantingWindow.objects.create(
            organization=self.org, crop=self.corn, variety=self.corn_early,
            start_month=5, start_day=1, end_month=6, end_day=1,
        )
        generic = services.resolve_window(self.corn, None, self.farm, 2026)
        specific = services.resolve_window(self.corn, self.corn_early, self.farm, 2026)
        self.assertEqual(generic["start"], date(2026, 4, 20))
        self.assertEqual(specific["start"], date(2026, 5, 1))

    def test_wrapping_winter_window(self):
        wheat = Crop.objects.create(organization=self.org, name="Wheat", category="grain", family="Poaceae")
        w = PlantingWindow.objects.create(
            organization=self.org, crop=wheat, start_month=9, start_day=20, end_month=10, end_day=20,
            harvest_by_month=7, harvest_by_day=20,
        )
        r = w.resolve(2026)
        self.assertEqual(r["harvest_by"], date(2027, 7, 20))

    def test_previous_occupant_conflict(self):
        prior = GrowingSeason.objects.create(
            organization=self.org, name="2025", start_date=date(2025, 3, 1), end_date=date(2025, 11, 30)
        )
        CropPlan.objects.create(
            field=self.f1, season=prior, crop=self.soy, planting_date=date(2025, 5, 1),
            expected_harvest_date=date(2026, 5, 10), status="growing",
        )
        a = services.assess_planting(self.f1, self.corn, None, date(2026, 5, 1), self.season)
        self.assertEqual(len(a["conflicts"]), 1)
        self.assertEqual(a["previous_crop"], "Soybean")

    def test_assess_endpoint(self):
        res = self.client.get(
            "/api/planning/assess/",
            {"field": self.f1.id, "crop": self.corn.id, "season": self.season.id, "planting_date": "2026-05-01"},
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["fit"], "optimal")

    def test_window_api_validates_dates(self):
        res = self.client.post(
            "/api/planting-windows/",
            {"crop": str(self.soy.id), "start_month": 2, "start_day": 30, "end_month": 5, "end_day": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.content)


class RotationTests(PlanningFixtureMixin, APITestCase):
    def test_same_crop_and_same_family_penalised(self):
        CropHistory.objects.create(field=self.f1, crop_name="Corn", planted_at=date(2025, 5, 1))
        same = services.rotation_check(self.f1, self.corn, self.season)
        self.assertLess(same["score"], 70)
        self.assertTrue(any("continuous" in w for w in same["warnings"]))
        wheat = Crop.objects.create(organization=self.org, name="Wheat", category="grain", family="Poaceae")
        family = services.rotation_check(self.f1, wheat, self.season)
        self.assertLess(family["score"], 100)
        self.assertGreater(family["score"], same["score"])

    def test_legume_credit_bonus(self):
        CropHistory.objects.create(field=self.f1, crop_name="Soybean", planted_at=date(2025, 5, 1))
        r = services.rotation_check(self.f1, self.corn, self.season)
        self.assertEqual(r["score"], 100)
        self.assertTrue(any("Legume credit" in n for n in r["notes"]))

    def _rotation(self):
        rot = RotationPlan.objects.create(farm=self.farm, name="CSW", start_year=2025)
        rot.fields.set([self.f1, self.f2])
        RotationStep.objects.create(rotation=rot, year_offset=0, order=0, crop=self.soy, role="main")
        RotationStep.objects.create(rotation=rot, year_offset=1, order=0, crop=self.corn, role="main")
        return rot

    def test_step_for_year_cycles_and_phases(self):
        rot = self._rotation()
        self.assertEqual(rot.step_for_year(2025).crop, self.soy)
        self.assertEqual(rot.step_for_year(2026).crop, self.corn)
        self.assertEqual(rot.step_for_year(2027).crop, self.soy)  # wraps
        res = self.client.put(
            f"/api/rotations/{rot.id}/phases/", [{"field": str(self.f2.id), "phase_offset": 1}], format="json"
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(rot.step_for_year(2026, field=self.f1).crop, self.corn)
        self.assertEqual(rot.step_for_year(2026, field=self.f2).crop, self.soy)

    def test_validate_flags_repeats(self):
        rot = RotationPlan.objects.create(farm=self.farm, name="Corn on corn")
        RotationStep.objects.create(rotation=rot, year_offset=0, crop=self.corn)
        RotationStep.objects.create(rotation=rot, year_offset=1, crop=self.corn)
        v = services.rotation_validate(rot)
        self.assertTrue(any("back-to-back" in i["message"] for i in v["issues"]))

    def test_preview_and_create_strategy(self):
        rot = self._rotation()
        step = rot.steps.get(year_offset=1)
        step.companion_crops.add(self.pea)
        res = self.client.get(f"/api/rotations/{rot.id}/preview/", {"season": self.season.id})
        self.assertEqual(res.status_code, 200, res.content)
        rows = {r["field_name"]: r for r in res.json()["fields"]}
        self.assertEqual(rows["North 80"]["crop_name"], "Corn")
        self.assertEqual(rows["North 80"]["companions"][0]["name"], "Field Pea")
        res = self.client.post(f"/api/rotations/{rot.id}/create-strategy/", {"season": str(self.season.id)}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual(len(body["allocations"]), 2)
        self.assertEqual(body["allocations"][0]["planting_system"], "intercrop")
        self.assertIn("totals", body["evaluation"])

    def test_rotation_list_and_detail_serialize(self):
        """Regression: a SerializerMethodField named `field_names` resolved to
        `get_field_names`, shadowing DRF's internal hook and 500ing every list."""
        rot = self._rotation()
        res = self.client.get("/api/rotations/")
        self.assertEqual(res.status_code, 200, res.content)
        row = next(r for r in res.json()["results"] if r["id"] == str(rot.id))
        self.assertEqual(sorted(row["field_names"]), ["Dry Flat", "North 80"])
        self.assertEqual(row["cycle_years"], 2)
        self.assertEqual(len(row["steps"]), 2)
        res = self.client.get(f"/api/rotations/{rot.id}/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["steps"][0]["crop_name"], "Soybean")

    def test_every_planning_list_endpoint_serializes(self):
        """Plain list on each new resource — catches serializer-level errors
        that action-only tests skip."""
        rot = self._rotation()
        s = FarmingStrategy.objects.create(organization=self.org, farm=self.farm, season=self.season, name="S")
        StrategyAllocation.objects.create(strategy=s, field=self.f1, crop=self.corn)
        ResourceConstraint.objects.create(organization=self.org, resource="acres", limit_value=100)
        CropPlan.objects.create(field=self.f1, season=self.season, crop=self.corn)
        for url in (
            "/api/crops/", "/api/varieties/", "/api/seasons/", "/api/planting-windows/", "/api/crop-plans/",
            "/api/crop-plan-components/", "/api/rotations/", "/api/rotation-steps/", "/api/resource-constraints/",
            "/api/strategies/", "/api/strategy-allocations/", f"/api/strategies/{s.id}/", f"/api/rotations/{rot.id}/",
        ):
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, f"{url}: {res.content[:200]}")

    def test_step_requires_crop_unless_fallow(self):
        rot = RotationPlan.objects.create(farm=self.farm, name="X")
        res = self.client.post("/api/rotation-steps/", {"rotation": str(rot.id), "year_offset": 0, "role": "main"}, format="json")
        self.assertEqual(res.status_code, 400)
        res = self.client.post("/api/rotation-steps/", {"rotation": str(rot.id), "year_offset": 0, "role": "fallow"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)


class VarietyRecommendationTests(PlanningFixtureMixin, APITestCase):
    def test_dryland_prefers_drought_tolerant_soil_matched(self):
        ranked = services.recommend_varieties(self.f2, self.corn, date(2026, 5, 1), self.season)
        self.assertEqual(ranked[0]["name"], "Early")
        self.assertTrue(any("Drought tolerant" in r for r in ranked[0]["reasons"]))

    def test_late_planting_penalises_long_maturity(self):
        ranked = services.recommend_varieties(self.f1, self.corn, date(2026, 7, 10), self.season)
        full = next(r for r in ranked if r["name"] == "Full Season")
        early = next(r for r in ranked if r["name"] == "Early")
        self.assertLess(full["score"], early["score"])

    def test_recommend_endpoint(self):
        res = self.client.get(
            "/api/varieties/recommend/",
            {"field": self.f2.id, "crop": self.corn.id, "season": self.season.id, "planting_date": "2026-05-01"},
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["results"][0]["name"], "Early")


class StrategyTests(PlanningFixtureMixin, APITestCase):
    def _strategy(self, name="Base", **kw):
        return FarmingStrategy.objects.create(organization=self.org, farm=self.farm, season=self.season, name=name, **kw)

    def test_evaluation_economics_and_mixed_cropping(self):
        s = self._strategy()
        StrategyAllocation.objects.create(strategy=s, field=self.f1, crop=self.corn, planting_date=date(2026, 5, 1))
        StrategyAllocation.objects.create(
            strategy=s, field=self.f2, crop=self.corn, planting_system="intercrop", planting_date=date(2026, 5, 1),
            components=[{"crop": str(self.pea.id), "share_pct": 25, "role": "intercrop"}],
        )
        ev = services.evaluate_strategy(s)
        t = ev["totals"]
        # f1: 80ac corn → 16000 bu × 4.5 = 72000; cost (110+300)×80 = 32800
        # f2: 30ac corn + 10ac pea → corn 6000×4.5=27000, pea 380×9=3420 → ×1.08 LER = 32853.6
        self.assertAlmostEqual(t["revenue"], 72000 + 32853.6, places=1)
        self.assertAlmostEqual(t["seed_cost"], 110 * 110 + 48 * 10, places=1)
        self.assertEqual(t["crop_acres"], {"Corn": 110.0, "Field Pea": 10.0})
        self.assertEqual(ev["crop_count"], 2)
        self.assertGreater(ev["diversity_index"], 0)
        self.assertTrue(ev["feasible"])
        dry = next(f for f in ev["fields"] if f["field_name"] == "Dry Flat")
        self.assertEqual(dry["components"][0]["crop_name"], "Field Pea")

    def test_assumptions_scale_results(self):
        base = self._strategy("Base")
        StrategyAllocation.objects.create(strategy=base, field=self.f1, crop=self.corn, planting_date=date(2026, 5, 1))
        dry = self._strategy("Dry", price_multiplier=Decimal("1.2"), rainfall_scenario="dry")
        StrategyAllocation.objects.create(strategy=dry, field=self.f1, crop=self.corn, planting_date=date(2026, 5, 1))
        eb, ed = services.evaluate_strategy(base), services.evaluate_strategy(dry)
        # dry: yield ×0.9, price ×1.2 → revenue ×1.08; water ×1.25
        self.assertAlmostEqual(ed["totals"]["revenue"], eb["totals"]["revenue"] * 1.08, places=0)
        self.assertAlmostEqual(ed["totals"]["water_acre_inches"], eb["totals"]["water_acre_inches"] * 1.25, places=0)

    def test_constraints_violation_blocks_adopt_unless_forced(self):
        ResourceConstraint.objects.create(
            organization=self.org, farm=self.farm, season=self.season, resource="water_acre_inches",
            limit_value=1000, is_hard=True,
        )
        ResourceConstraint.objects.create(
            organization=self.org, resource="labor_hours", limit_value=100, is_hard=False,
        )
        s = self._strategy()
        StrategyAllocation.objects.create(strategy=s, field=self.f1, crop=self.corn, planting_date=date(2026, 5, 1))
        ev = services.evaluate_strategy(s)
        self.assertFalse(ev["feasible"])
        statuses = {c["resource"]: c["status"] for c in ev["constraints"]}
        self.assertEqual(statuses["water_acre_inches"], "violated")
        self.assertEqual(statuses["labor_hours"], "exceeded")
        res = self.client.post(f"/api/strategies/{s.id}/adopt/", {}, format="json")
        self.assertEqual(res.status_code, 409)
        res = self.client.post(f"/api/strategies/{s.id}/adopt/", {"force": True}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(len(res.json()["created"]), 1)

    def test_farm_season_constraint_overrides_org_wide(self):
        ResourceConstraint.objects.create(organization=self.org, resource="acres", limit_value=1000)
        ResourceConstraint.objects.create(
            organization=self.org, farm=self.farm, season=self.season, resource="acres", limit_value=50
        )
        rows = services.applicable_constraints(self.org.id, self.farm.id, self.season.id)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].limit_value, 50)

    def test_adopt_materialises_plans_and_components(self):
        s = self._strategy()
        StrategyAllocation.objects.create(
            strategy=s, field=self.f1, crop=self.corn, variety=self.corn_early, planting_system="intercrop",
            planting_date=date(2026, 5, 1),
            components=[{"crop": str(self.pea.id), "share_pct": 30, "role": "intercrop", "row_arrangement": "2:1"}],
        )
        result = services.adopt_strategy(s)
        self.assertEqual(len(result["created"]), 1)
        plan = CropPlan.objects.get(field=self.f1, season=self.season)
        self.assertEqual(plan.strategy_id, s.id)
        self.assertEqual(plan.planting_system, "intercrop")
        self.assertEqual(plan.expected_harvest_date, date(2026, 8, 14))  # 105 days
        self.assertEqual(plan.components.count(), 1)
        self.assertEqual(plan.components.first().row_arrangement, "2:1")
        s.refresh_from_db()
        self.assertEqual(s.status, "adopted")
        # Re-adopting a sibling demotes the first and reuses the planned plan.
        s2 = services.clone_strategy(s, name="Variant")
        s2.allocations.update(crop=self.soy, variety=None, components=[], planting_system="monoculture")
        r2 = services.adopt_strategy(s2)
        self.assertEqual(len(r2["updated"]), 1)
        s.refresh_from_db()
        self.assertEqual(s.status, "candidate")
        self.assertEqual(CropPlan.objects.filter(field=self.f1, season=self.season).count(), 1)

    def test_adopt_skips_fields_already_planted(self):
        CropPlan.objects.create(field=self.f1, season=self.season, crop=self.soy, status="planted")
        s = self._strategy()
        StrategyAllocation.objects.create(strategy=s, field=self.f1, crop=self.corn)
        r = services.adopt_strategy(s)
        self.assertEqual(len(r["skipped"]), 1)
        self.assertEqual(CropPlan.objects.get(field=self.f1).crop, self.soy)

    def test_compare_endpoint_marks_best_and_deltas(self):
        a = self._strategy("A", is_baseline=True)
        StrategyAllocation.objects.create(strategy=a, field=self.f1, crop=self.corn, planting_date=date(2026, 5, 1))
        b = self._strategy("B")
        StrategyAllocation.objects.create(strategy=b, field=self.f1, crop=self.soy, planting_date=date(2026, 5, 1))
        res = self.client.get("/api/strategies/compare/", {"ids": f"{a.id},{b.id}"})
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body["baseline_id"], str(a.id))
        margin = next(m for m in body["metrics"] if m["key"] == "totals.margin")
        self.assertEqual(margin["deltas"][0], 0.0)
        self.assertIsNotNone(margin["best_index"])
        water = next(m for m in body["metrics"] if m["key"] == "totals.water_acre_inches")
        self.assertEqual(water["best_index"], 1)  # soy uses less water
        self.assertEqual(len(body["ranking"]), 2)

    def test_bulk_allocations_endpoint_validates_and_evaluates(self):
        s = self._strategy()
        res = self.client.put(
            f"/api/strategies/{s.id}/allocations/",
            [
                {"field": str(self.f1.id), "crop": str(self.corn.id), "planting_date": "2026-05-01"},
                {"field": str(self.f2.id), "crop": str(self.soy.id), "components": [{"crop": str(self.pea.id), "share_pct": 150}]},
            ],
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.content)
        self.assertEqual(s.allocations.count(), 0)  # nothing partially applied
        res = self.client.put(
            f"/api/strategies/{s.id}/allocations/",
            [{"field": str(self.f1.id), "crop": str(self.corn.id), "planting_date": "2026-05-01"}],
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["evaluation"]["totals"]["acres"], 80.0)

    def test_only_one_baseline_per_farm_season(self):
        a = self._strategy("A", is_baseline=True)
        res = self.client.post(
            "/api/strategies/",
            {"farm": str(self.farm.id), "season": str(self.season.id), "name": "B", "is_baseline": True},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        a.refresh_from_db()
        self.assertFalse(a.is_baseline)

    def test_allocation_rejects_other_farm_field(self):
        other = Farm.objects.create(organization=self.org, name="Other")
        f = Field.objects.create(farm=other, name="Elsewhere", acres=10)
        s = self._strategy()
        res = self.client.post(
            "/api/strategy-allocations/", {"strategy": str(s.id), "field": str(f.id), "crop": str(self.corn.id)}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    def test_season_usage_from_committed_plans(self):
        CropPlan.objects.create(field=self.f1, season=self.season, crop=self.corn, status="planted")
        ResourceConstraint.objects.create(organization=self.org, season=self.season, resource="acres", limit_value=100)
        res = self.client.get("/api/planning/constraints/", {"season": self.season.id})
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body["metrics"]["acres"], 80.0)
        self.assertEqual(body["constraints"][0]["utilization_pct"], 80.0)


class PlanningFarmAccessTests(PlanningFixtureMixin, APITestCase):
    """New planning models hop through `strategy`/`rotation` to the farm, so a
    member restricted to another farm must not see them."""

    def setUp(self):
        super().setUp()
        self.other = Farm.objects.create(organization=self.org, name="Elsewhere")
        self.strategy = FarmingStrategy.objects.create(
            organization=self.org, farm=self.farm, season=self.season, name="Hidden"
        )
        StrategyAllocation.objects.create(strategy=self.strategy, field=self.f1, crop=self.corn)
        self.rotation = RotationPlan.objects.create(farm=self.farm, name="Hidden rotation")
        RotationStep.objects.create(rotation=self.rotation, year_offset=0, crop=self.corn)
        scout = User.objects.create_user(email="scout@planning.test", password="Scouting!2026-strong")
        role = Role.objects.create(organization=self.org, name="Scout", permissions=["farms.view"])
        Membership.objects.create(user=scout, organization=self.org, role=role)
        FarmAccess.objects.create(user=scout, farm=self.other, can_view=True)
        res = self.client.post(
            "/api/auth/login/", {"email": "scout@planning.test", "password": "Scouting!2026-strong"}, format="json"
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {res.json()['access']}", HTTP_X_ORGANIZATION_ID=str(self.org.id)
        )

    def test_restricted_member_sees_no_planning_rows_for_other_farm(self):
        for url in ("/api/strategies/", "/api/strategy-allocations/", "/api/rotations/", "/api/rotation-steps/"):
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, url)
            self.assertEqual(res.json()["count"], 0, url)
        self.assertEqual(self.client.get(f"/api/strategies/{self.strategy.id}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/rotations/{self.rotation.id}/").status_code, 404)
        self.assertIn(self.client.post(f"/api/strategies/{self.strategy.id}/evaluate/").status_code, (403, 404))

    def test_restricted_member_cannot_allocate_onto_other_farm(self):
        mine = FarmingStrategy.objects.create(organization=self.org, farm=self.other, season=self.season, name="Mine")
        res = self.client.post(
            "/api/strategy-allocations/",
            {"strategy": str(mine.id), "field": str(self.f1.id), "crop": str(self.corn.id)},
            format="json",
        )
        self.assertEqual(res.status_code, 400)


class CropPlanComponentTests(PlanningFixtureMixin, APITestCase):
    def test_component_share_and_variety_validation(self):
        plan = CropPlan.objects.create(field=self.f1, season=self.season, crop=self.corn, planting_system="intercrop")
        res = self.client.post(
            "/api/crop-plan-components/",
            {"crop_plan": str(plan.id), "crop": str(self.pea.id), "variety": str(self.corn_early.id), "share_pct": 30},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        res = self.client.post(
            "/api/crop-plan-components/",
            {"crop_plan": str(plan.id), "crop": str(self.pea.id), "share_pct": 30, "role": "intercrop"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        res = self.client.get(f"/api/crop-plans/{plan.id}/")
        self.assertEqual(len(res.json()["components"]), 1)
        self.assertEqual(res.json()["components"][0]["crop_name"], "Field Pea")

    def test_plan_assessment_action(self):
        plan = CropPlan.objects.create(
            field=self.f1, season=self.season, crop=self.corn, variety=self.corn_early, planting_date=date(2026, 5, 1)
        )
        res = self.client.get(f"/api/crop-plans/{plan.id}/assessment/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["fit"], "optimal")
        self.assertEqual(res.json()["days_to_maturity"], 105)
