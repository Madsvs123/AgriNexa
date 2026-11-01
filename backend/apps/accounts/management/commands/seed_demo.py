from datetime import date, time, timedelta
from decimal import Decimal
from random import Random

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import FarmerProfile, User
from apps.crops import services as crop_services
from apps.crops.models import (
    Crop,
    CropPlan,
    CropVariety,
    FarmingStrategy,
    FertilizerPlan,
    GrowingSeason,
    PesticideApplication,
    PlantingSchedule,
    PlantingWindow,
    ResourceConstraint,
    RotationPlan,
    RotationStep,
    SeasonalBudget,
    StrategyAllocation,
)
from apps.equipment.models import Breakdown, Equipment, FuelLog, MaintenanceSchedule, ServiceHistory
from apps.farms.models import CropHistory, Farm, Field, FieldNote, Plot, Region
from apps.inventory.models import InventoryItem, StockMovement
from apps.irrigation.models import (
    IrrigationEvent,
    IrrigationRecommendation,
    IrrigationSchedule,
    IrrigationZone,
    WaterUsage,
)
from apps.platform.models import Notification, Task
from apps.scouting.models import DiseaseObservation, PestIncident, ScoutReport, TreatmentPlan, WeedPressure
from apps.sensors.defaults import ensure_builtin_sensor_types
from apps.sensors.models import DeviceHealth, Sensor, SensorReading, SensorType
from apps.tenancy.models import Membership, Organization, Team, TeamMembership
from apps.tenancy.services import create_default_roles
from apps.weather.models import WeatherAlert, WeatherForecast, WeatherReading, WeatherStation

DEMO_PASSWORD = "Farmland#2026"
ORG_SLUG = "green-valley-cooperative"
RNG = Random(2026)


def polygon(lat, lng, delta=0.008):
    lat, lng, delta = float(lat), float(lng), float(delta)
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [lng - delta, lat - delta],
                [lng + delta, lat - delta],
                [lng + delta, lat + delta],
                [lng - delta, lat + delta],
                [lng - delta, lat - delta],
            ]
        ],
    }


def user_at(email, first, last, phone=""):
    user, created = User.objects.get_or_create(
        email=email,
        defaults={"first_name": first, "last_name": last, "phone": phone, "is_active": True},
    )
    user.set_password(DEMO_PASSWORD)
    user.first_name = first
    user.last_name = last
    user.phone = phone or user.phone
    user.is_active = True
    user.save()
    FarmerProfile.objects.get_or_create(
        user=user,
        defaults={
            "experience_years": 12 if "farmer" in email else 6,
            "specialties": ["corn", "soybean", "irrigation"],
            "preferred_language": "en",
            "bio": "Demo AgriNexa operator.",
            "certifications": ["CCA", "Pesticide applicator"],
        },
    )
    return user


class Command(BaseCommand):
    help = "Seed a demo organization with farms, sensors, crops, and operations data."

    @transaction.atomic
    def handle(self, *args, **options):
        ensure_builtin_sensor_types()
        org = self._org()
        roles = create_default_roles(org)
        owner = user_at("farmer@agrinexa.local", "Maya", "Hassan", "+15155550101")
        manager = user_at("manager@agrinexa.local", "Luis", "Ortega", "+15155550102")
        operator = user_at("operator@agrinexa.local", "Priya", "Shah", "+15155550103")
        self._membership(owner, org, roles["Owner"], is_owner=True)
        self._membership(manager, org, roles["Manager"])
        self._membership(operator, org, roles["Operator"])

        team, _ = Team.objects.get_or_create(
            organization=org, name="Field Operations", defaults={"description": "Scouting and irrigation crew"}
        )
        for member in (owner, manager, operator):
            TeamMembership.objects.get_or_create(team=team, user=member)

        region, _ = Region.objects.get_or_create(
            organization=org,
            name="Des Moines Valley",
            defaults={"code": "IA-DM", "geojson": polygon(41.6, -93.6, 0.08)},
        )
        north, cedar = self._farms(org, region)
        fields = self._fields(north, cedar)
        crops, varieties, season = self._crops(org, north)
        plans = self._crop_plans(fields, crops, varieties, season, north)
        self._planning(org, north, fields, crops, varieties, season, owner)
        zones = self._irrigation(fields, operator)
        sensors = self._sensors(org, fields, zones)
        self._weather(north, cedar, sensors)
        self._inventory(org, north, cedar, owner)
        self._equipment(north, cedar, operator)
        self._scouting(fields, owner, operator)
        self._platform(org, north, fields, owner, manager, operator)
        self.stdout.write(self.style.SUCCESS(f"Seeded {org.name} with {len(fields)} fields and {len(sensors)} sensors."))

    def _org(self):
        org, _ = Organization.objects.update_or_create(
            slug=ORG_SLUG,
            defaults={
                "name": "Green Valley Cooperative",
                "org_type": Organization.OrgType.COOPERATIVE,
                "country": "US",
                "timezone": "America/Chicago",
                "is_active": True,
                "settings": {
                    "units": "imperial",
                    "currency": "USD",
                    "moisture_unit": "percent",
                    "map_default_center": {"lat": 41.6, "lng": -93.6},
                },
            },
        )
        return org

    def _membership(self, user, org, role, is_owner=False):
        Membership.objects.update_or_create(
            user=user,
            organization=org,
            defaults={"role": role, "is_owner": is_owner, "is_active": True},
        )

    def _farms(self, org, region):
        north, _ = Farm.objects.update_or_create(
            organization=org,
            code="NRF-01",
            defaults={
                "region": region,
                "name": "North Ridge Farm",
                "address": "4180 Ridge Rd, Polk County, IA",
                "lat": Decimal("41.620000"),
                "lng": Decimal("-93.620000"),
                "total_acres": Decimal("640.00"),
                "timezone": "America/Chicago",
                "soil_summary": "Silty clay loam with good organic matter.",
                "contact_name": "Maya Hassan",
                "contact_phone": "+15155550101",
                "status": Farm.Status.ACTIVE,
                "notes": "Primary grain operation.",
            },
        )
        cedar, _ = Farm.objects.update_or_create(
            organization=org,
            code="CCF-02",
            defaults={
                "region": region,
                "name": "Cedar Creek Farm",
                "address": "902 Cedar Creek Ln, Warren County, IA",
                "lat": Decimal("41.580000"),
                "lng": Decimal("-93.580000"),
                "total_acres": Decimal("320.00"),
                "timezone": "America/Chicago",
                "soil_summary": "Loam over sandy subsoil near the creek.",
                "contact_name": "Luis Ortega",
                "contact_phone": "+15155550102",
                "status": Farm.Status.ACTIVE,
                "notes": "Diversified vegetables and forage.",
            },
        )
        return north, cedar

    def _fields(self, north, cedar):
        specs = [
            (north, "North 80", "N80", 80, 41.628, -93.628, "silty clay loam", "6.4", "pivot", "planted"),
            (north, "West Bottom", "WB40", 40, 41.616, -93.632, "clay loam", "6.1", "drip", "planted"),
            (north, "East Ridge", "ER90", 90, 41.622, -93.608, "silt loam", "6.7", "sprinkler", "growing" if False else "planted"),
            (cedar, "Creek Side", "CS35", 35, 41.576, -93.574, "loam", "6.5", "drip", "planted"),
            (cedar, "Hilltop Garden", "HG22", 22, 41.586, -93.586, "sandy loam", "6.8", "sprinkler", "prep"),
        ]
        fields = []
        for farm, name, code, acres, lat, lng, soil, ph, irrigation, status in specs:
            field, _ = Field.objects.update_or_create(
                farm=farm,
                code=code,
                defaults={
                    "name": name,
                    "acres": Decimal(acres),
                    "boundary": polygon(lat, lng, 0.006),
                    "soil_type": soil,
                    "soil_ph": Decimal(ph),
                    "organic_matter": Decimal("3.40"),
                    "irrigation_type": irrigation,
                    "drainage": "tiled",
                    "status": status,
                    "centroid_lat": Decimal(str(lat)),
                    "centroid_lng": Decimal(str(lng)),
                    "planting_date": date(2026, 4, 18),
                    "expected_harvest_date": date(2026, 9, 28),
                },
            )
            Plot.objects.get_or_create(
                field=field, name=f"{name} A", defaults={"acres": Decimal(acres) / 2, "boundary": polygon(lat, lng, 0.003)}
            )
            CropHistory.objects.get_or_create(
                field=field,
                season_name="2025",
                crop_name="Soybean" if "corn" not in name.lower() else "Corn",
                defaults={
                    "variety_name": "Pioneer 37T",
                    "planted_at": date(2025, 4, 22),
                    "harvested_at": date(2025, 10, 2),
                    "yield_amount": Decimal("58.00"),
                    "yield_unit": "bu",
                    "notes": "Prior season rotation.",
                },
            )
            fields.append(field)
        return fields

    def _crops(self, org, farm):
        # name, category, scientific, days, water, color, family, n_fix, root,
        # water_in, labor_h, n_lb, yield/ac, unit, price/unit, seed $/ac, inputs $/ac
        crop_specs = [
            ("Corn", "grain", "Zea mays", 120, "high", "#E6B800", "Poaceae", False, "deep",
             24, 2.8, 180, 200, "bu", 4.60, 115, 310),
            ("Soybean", "legume", "Glycine max", 110, "medium", "#5C8A3C", "Fabaceae", True, "medium",
             18, 2.1, 0, 60, "bu", 11.20, 62, 150),
            ("Wheat", "grain", "Triticum aestivum", 100, "medium", "#C4A35A", "Poaceae", False, "medium",
             16, 1.9, 90, 72, "bu", 6.10, 38, 165),
            ("Alfalfa", "forage", "Medicago sativa", 60, "medium", "#3D8B5B", "Fabaceae", True, "deep",
             26, 4.5, 0, 5, "ton", 210.00, 55, 120),
            ("Tomato", "vegetable", "Solanum lycopersicum", 85, "high", "#C0392B", "Solanaceae", False, "medium",
             28, 42.0, 150, 28, "ton", 95.00, 650, 2400),
            ("Cereal Rye", "cover", "Secale cereale", 200, "low", "#8C7B5A", "Poaceae", False, "deep",
             4, 0.6, 0, 0, "ton", 0, 28, 10),
            ("Field Pea", "legume", "Pisum sativum", 95, "low", "#7FB069", "Fabaceae", True, "shallow",
             12, 1.8, 0, 38, "bu", 9.50, 48, 95),
        ]
        crops = {}
        for (name, category, sci, days, water, color, family, n_fix, root,
             water_in, labor_h, n_lb, yld, unit, price, seed_cost, input_cost) in crop_specs:
            crop, _ = Crop.objects.update_or_create(
                organization=org,
                name=name,
                defaults={
                    "category": category,
                    "scientific_name": sci,
                    "typical_days": days,
                    "water_need": water,
                    "color_hex": color,
                    "family": family,
                    "nitrogen_fixing": n_fix,
                    "root_depth": root,
                    "water_acre_inches": Decimal(str(water_in)),
                    "labor_hours_per_acre": Decimal(str(labor_h)),
                    "nitrogen_lb_per_acre": Decimal(str(n_lb)),
                    "expected_yield_per_acre": Decimal(str(yld)),
                    "yield_unit": unit,
                    "expected_price_per_unit": Decimal(str(price)),
                    "seed_cost_per_acre": Decimal(str(seed_cost)),
                    "input_cost_per_acre": Decimal(str(input_cost)),
                },
            )
            crops[name] = crop
        crops["Corn"].compatible_intercrops.set([crops["Soybean"], crops["Field Pea"]])
        crops["Wheat"].compatible_intercrops.set([crops["Field Pea"]])
        varieties = {}
        # crop, name, dtm, seed rate, yield, unit, traits, maturity grp, drought 1-5,
        # disease resistance, suitable soils, seed $/ac override
        variety_specs = [
            ("Corn", "DKC 62-08", 118, 32000, 210, "bu", ["drought-tolerant"], "RM 112", 4,
             ["gray leaf spot"], ["silty clay loam", "silt loam", "clay loam"], None),
            ("Corn", "P0953AM", 109, 34000, 198, "bu", ["early"], "RM 109", 3,
             ["northern leaf blight"], ["silt loam", "loam", "sandy loam"], 108),
            ("Corn", "DKC 70-27", 125, 32000, 222, "bu", ["full-season"], "RM 120", 2,
             [], ["silty clay loam", "clay loam"], 124),
            ("Soybean", "AG36X6", 108, 140000, 62, "bu", ["RR2X"], "MG 3.6", 3,
             ["SCN", "phytophthora"], ["silty clay loam", "clay loam", "silt loam", "loam"], None),
            ("Soybean", "P28A42X", 102, 140000, 58, "bu", ["early"], "MG 2.8", 4,
             ["SCN"], ["loam", "sandy loam", "silt loam"], 60),
            ("Wheat", "SY Wolf", 98, 120, 72, "bu", ["fusarium-resistant"], "", 3,
             ["fusarium head blight"], ["silt loam", "loam", "clay loam"], None),
            ("Alfalfa", "WL 358LH", 55, 18, 5, "ton", ["high-lignin"], "FD 4", 4,
             ["anthracnose"], ["loam", "silt loam", "silty clay loam"], None),
            ("Tomato", "Mountain Merit", 80, 8000, 28, "ton", ["late-blight-resistant"], "", 2,
             ["late blight", "TSWV"], ["sandy loam", "loam"], None),
            ("Cereal Rye", "Elbon", 200, 90, 0, "ton", ["cover"], "", 5, [], [], None),
            ("Field Pea", "Hampton", 92, 180, 38, "bu", ["semi-leafless"], "", 4,
             ["powdery mildew"], ["loam", "sandy loam", "silt loam"], None),
        ]
        for (crop_name, vname, days, seed, yld, unit, traits, mg, drought,
             diseases, soils, seed_cost) in variety_specs:
            variety, _ = CropVariety.objects.update_or_create(
                crop=crops[crop_name],
                name=vname,
                defaults={
                    "days_to_maturity": days,
                    "seed_rate_per_acre": Decimal(seed),
                    "expected_yield_per_acre": Decimal(yld),
                    "yield_unit": unit,
                    "traits": traits,
                    "maturity_group": mg,
                    "drought_tolerance": drought,
                    "disease_resistance": diseases,
                    "suitable_soils": soils,
                    "seed_cost_per_acre": Decimal(str(seed_cost)) if seed_cost else None,
                    "is_active": True,
                },
            )
            varieties.setdefault(crop_name, variety)
        season, _ = GrowingSeason.objects.update_or_create(
            organization=org,
            name="2026 Season",
            defaults={
                "farm": None,
                "start_date": date(2026, 3, 15),
                "end_date": date(2026, 11, 15),
                "is_active": True,
            },
        )
        RotationPlan.objects.update_or_create(
            farm=farm,
            name="Corn-Soy-Wheat",
            defaults={
                "is_active": True,
                "sequence": [
                    {"year": 2025, "crop_id": str(crops["Soybean"].id), "notes": "Soybeans"},
                    {"year": 2026, "crop_id": str(crops["Corn"].id), "notes": "Corn"},
                    {"year": 2027, "crop_id": str(crops["Wheat"].id), "notes": "Wheat"},
                ],
            },
        )
        return crops, varieties, season

    def _crop_plans(self, fields, crops, varieties, season, farm):
        mapping = [
            (fields[0], "Corn", "growing", date(2026, 4, 18), date(2026, 9, 25), 200),
            (fields[1], "Soybean", "planted", date(2026, 5, 2), date(2026, 10, 4), 60),
            (fields[2], "Corn", "growing", date(2026, 4, 22), date(2026, 9, 30), 195),
            (fields[3], "Tomato", "planted", date(2026, 5, 10), date(2026, 8, 20), 24),
            (fields[4], "Alfalfa", "planned", date(2026, 9, 15), date(2026, 11, 1), 4),
        ]
        plans = []
        for field, crop_name, status, planted, harvest, target in mapping:
            plan, _ = CropPlan.objects.update_or_create(
                field=field,
                season=season,
                crop=crops[crop_name],
                defaults={
                    "variety": varieties[crop_name],
                    "planting_date": planted,
                    "expected_harvest_date": harvest,
                    "target_yield": Decimal(target),
                    "yield_unit": varieties[crop_name].yield_unit,
                    "seed_required": Decimal("40"),
                    "status": status,
                    "notes": "Demo crop plan",
                },
            )
            if status in (CropPlan.Status.PLANTED, CropPlan.Status.GROWING):
                field.current_crop_plan = plan
                field.planting_date = planted
                field.expected_harvest_date = harvest
                field.status = Field.Status.PLANTED
                field.save()
            PlantingSchedule.objects.get_or_create(
                crop_plan=plan, stage="Planting", defaults={"scheduled_date": planted, "completed_date": planted}
            )
            PlantingSchedule.objects.get_or_create(
                crop_plan=plan, stage="Side-dress N", defaults={"scheduled_date": planted + timedelta(days=35)}
            )
            FertilizerPlan.objects.get_or_create(
                crop_plan=plan,
                product_name="UAN 32%",
                defaults={
                    "nutrient_analysis": "32-0-0",
                    "rate_per_acre": Decimal("40"),
                    "unit": "gal",
                    "application_date": planted + timedelta(days=30),
                    "method": "sidedress",
                    "cost": Decimal("1800"),
                },
            )
            PesticideApplication.objects.get_or_create(
                crop_plan=plan,
                product_name="Glyphosate 4lb",
                defaults={
                    "target_pest": "weeds",
                    "rate_per_acre": Decimal("32"),
                    "unit": "oz",
                    "application_date": planted + timedelta(days=20),
                    "reentry_hours": 12,
                    "phi_days": 7,
                    "applicator": "Priya Shah",
                },
            )
            plans.append(plan)
        for category, planned, actual in [
            ("seed", 42000, 40110),
            ("fertilizer", 38000, 35200),
            ("chemical", 18000, 16450),
            ("labor", 24000, 22100),
            ("fuel", 12000, 11880),
            ("water", 9000, 7600),
        ]:
            SeasonalBudget.objects.update_or_create(
                season=season,
                farm=farm,
                category=category,
                defaults={
                    "planned_amount": Decimal(planned),
                    "actual_amount": Decimal(actual),
                    "currency": "USD",
                },
            )
        return plans

    def _planning(self, org, farm, fields, crops, varieties, season, owner):
        """Planting windows, a structured rotation, constraints, and two
        strategies so the Grow workbench has something to compare."""
        # Planting windows (Iowa-ish). crop, start, end, late_end, harvest_by
        for crop_name, start, end, late, harvest_by, soil_c in [
            ("Corn", (4, 20), (5, 15), (6, 5), (10, 25), 10.0),
            ("Soybean", (5, 1), (5, 30), (6, 25), (10, 20), 12.0),
            ("Wheat", (9, 20), (10, 20), (11, 5), (7, 20), 4.0),
            ("Alfalfa", (4, 1), (5, 10), (8, 25), (11, 1), 7.0),
            ("Tomato", (5, 15), (6, 10), (6, 25), (9, 30), 15.0),
            ("Cereal Rye", (9, 1), (10, 15), (11, 1), None, 1.0),
            ("Field Pea", (4, 1), (5, 1), (5, 20), (8, 15), 4.0),
        ]:
            PlantingWindow.objects.update_or_create(
                organization=org,
                crop=crops[crop_name],
                variety=None,
                farm=None,
                defaults={
                    "start_month": start[0],
                    "start_day": start[1],
                    "end_month": end[0],
                    "end_day": end[1],
                    "late_end_month": late[0],
                    "late_end_day": late[1],
                    "harvest_by_month": harvest_by[0] if harvest_by else None,
                    "harvest_by_day": harvest_by[1] if harvest_by else None,
                    "min_soil_temp_c": Decimal(str(soil_c)),
                    "source": "ISU Extension (demo)",
                },
            )

        # Structured 3-year rotation with a rye cover after corn.
        rotation = RotationPlan.objects.get(farm=farm, name="Corn-Soy-Wheat")
        rotation.start_year = 2025
        rotation.notes = "Classic Corn Belt rotation; rye cover after corn protects soil over winter."
        rotation.save(update_fields=["start_year", "notes", "updated_at"])
        north_fields = [f for f in fields if f.farm_id == farm.id]
        rotation.fields.set(north_fields)
        rotation.steps.all().delete()
        step_specs = [
            (0, 0, "Soybean", "main", [], "Year 1"),
            (1, 0, "Corn", "main", [], "Year 2"),
            (1, 1, "Cereal Rye", "cover", [], "Winter"),
            (2, 0, "Wheat", "main", ["Field Pea"], "Year 3"),
        ]
        for year_offset, order, crop_name, role, companions, label in step_specs:
            step = RotationStep.objects.create(
                rotation=rotation,
                year_offset=year_offset,
                order=order,
                crop=crops[crop_name],
                variety=varieties.get(crop_name),
                role=role,
                season_label=label,
            )
            if companions:
                step.companion_crops.set([crops[c] for c in companions])

        # Resource constraints for the farm-season.
        for resource, limit, unit, hard in [
            ("water_acre_inches", 4200, "ac-in", True),
            ("labor_hours", 900, "h", False),
            ("nitrogen_lb", 30000, "lb", False),
            ("total_budget", 120000, "USD", True),
            ("acres", 230, "ac", True),
        ]:
            ResourceConstraint.objects.update_or_create(
                organization=org,
                farm=farm,
                season=season,
                resource=resource,
                defaults={"limit_value": Decimal(limit), "unit": unit, "is_hard": hard},
            )

        # Baseline strategy mirrors what is actually planted.
        baseline, _ = FarmingStrategy.objects.update_or_create(
            organization=org,
            farm=farm,
            season=season,
            name="Current plan",
            defaults={
                "description": "What is in the ground this season.",
                "status": "adopted",
                "is_baseline": True,
                "created_by": owner,
            },
        )
        baseline.allocations.all().delete()
        for plan in CropPlan.objects.filter(season=season, field__farm=farm).select_related("field", "crop", "variety"):
            StrategyAllocation.objects.create(
                strategy=baseline,
                field=plan.field,
                crop=plan.crop,
                variety=plan.variety,
                planting_date=plan.planting_date,
                planting_system="monoculture",
            )

        # Alternative: more soy + a corn/pea intercrop on the ridge, drier year.
        alt, _ = FarmingStrategy.objects.update_or_create(
            organization=org,
            farm=farm,
            season=season,
            name="Diversify + intercrop",
            defaults={
                "description": "Swap one corn field to soy, intercrop corn with field pea on East Ridge, assume a dry year.",
                "status": "candidate",
                "is_baseline": False,
                "rotation": rotation,
                "rainfall_scenario": "dry",
                "created_by": owner,
            },
        )
        alt.allocations.all().delete()
        by_name = {f.name: f for f in north_fields}
        StrategyAllocation.objects.create(
            strategy=alt, field=by_name["North 80"], crop=crops["Soybean"], variety=varieties["Soybean"],
            planting_date=date(2026, 5, 8), planting_system="monoculture",
        )
        StrategyAllocation.objects.create(
            strategy=alt, field=by_name["West Bottom"], crop=crops["Soybean"], variety=varieties["Soybean"],
            planting_date=date(2026, 5, 6), planting_system="monoculture",
        )
        StrategyAllocation.objects.create(
            strategy=alt, field=by_name["East Ridge"], crop=crops["Corn"], variety=varieties["Corn"],
            planting_date=date(2026, 4, 28), planting_system="intercrop",
            components=[{"crop": str(crops["Field Pea"].id), "variety": None, "share_pct": 30, "role": "intercrop"}],
        )
        for s in (baseline, alt):
            crop_services.evaluate_strategy(s)

    def _irrigation(self, fields, operator):
        zones = []
        for field in fields[:4]:
            zone, _ = IrrigationZone.objects.update_or_create(
                farm=field.farm,
                name=f"{field.name} Zone",
                defaults={
                    "field": field,
                    "acres": field.acres,
                    "method": field.irrigation_type if field.irrigation_type != "none" else "drip",
                    "moisture_low_threshold": Decimal("22.00"),
                    "moisture_high_threshold": Decimal("38.00"),
                    "flow_rate_gpm": Decimal("180.00"),
                    "is_active": True,
                    "boundary": field.boundary,
                },
            )
            IrrigationSchedule.objects.update_or_create(
                zone=zone,
                name="Dawn cycle",
                defaults={
                    "start_time": time(5, 30),
                    "duration_minutes": 45,
                    "recurrence": IrrigationSchedule.Recurrence.DAILY,
                    "days_of_week": [0, 1, 2, 3, 4, 5, 6],
                    "is_active": True,
                    "next_run": timezone.now() + timedelta(hours=8),
                },
            )
            for i in range(14):
                day = timezone.now().date() - timedelta(days=i)
                WaterUsage.objects.update_or_create(
                    zone=zone,
                    usage_date=day,
                    defaults={
                        "gallons": Decimal(str(18000 + RNG.randint(-2000, 2500))),
                        "source": WaterUsage.Source.WELL,
                        "cost": Decimal(str(45 + RNG.randint(0, 20))),
                    },
                )
            IrrigationEvent.objects.get_or_create(
                zone=zone,
                started_at=timezone.now() - timedelta(hours=6),
                defaults={
                    "ended_at": timezone.now() - timedelta(hours=5),
                    "water_used_gallons": Decimal("8500"),
                    "mode": IrrigationEvent.Mode.AUTO,
                    "triggered_by": operator,
                    "notes": "Scheduled cycle",
                },
            )
            IrrigationRecommendation.objects.get_or_create(
                zone=zone,
                reason=f"Soil moisture trending below {zone.moisture_low_threshold}% on {field.name}.",
                defaults={
                    "suggested_duration_minutes": 40,
                    "moisture_avg": Decimal("19.40"),
                    "status": IrrigationRecommendation.Status.PENDING,
                },
            )
            zones.append(zone)
        return zones

    def _sensors(self, org, fields, zones):
        moisture = SensorType.objects.get(organization=None, name="Soil Moisture")
        temp = SensorType.objects.get(organization=None, name="Air Temperature")
        rain = SensorType.objects.get(organization=None, name="Rainfall")
        sensors = []
        now = timezone.now()
        for idx, field in enumerate(fields):
            zone = zones[idx] if idx < len(zones) else None
            sensor, _ = Sensor.objects.update_or_create(
                serial=f"SM-{field.code}-01",
                defaults={
                    "organization": org,
                    "farm": field.farm,
                    "field": field,
                    "irrigation_zone": zone.id if zone else None,
                    "name": f"{field.name} moisture",
                    "sensor_type": moisture,
                    "lat": field.centroid_lat,
                    "lng": field.centroid_lng,
                    "status": Sensor.Status.ONLINE,
                    "installed_at": now - timedelta(days=120),
                    "last_seen": now - timedelta(minutes=8),
                    "metadata": {"depth_in": 8},
                },
            )
            DeviceHealth.objects.update_or_create(
                sensor=sensor,
                defaults={
                    "battery_pct": Decimal(str(70 + RNG.randint(0, 25))),
                    "signal_dbm": -65,
                    "firmware": "2.4.1",
                    "temperature_c": Decimal("24.10"),
                    "uptime_hours": Decimal("840"),
                    "last_error": "",
                },
            )
            self._readings(sensor, base=24, amplitude=8, now=now)
            sensors.append(sensor)
        for farm, suffix, stype, name, base in [
            (fields[0].farm, "NRF-T", temp, "North Ridge temp", 22),
            (fields[3].farm, "CCF-R", rain, "Cedar Creek rain", 0.4),
        ]:
            sensor, _ = Sensor.objects.update_or_create(
                serial=suffix,
                defaults={
                    "organization": org,
                    "farm": farm,
                    "field": None,
                    "name": name,
                    "sensor_type": stype,
                    "lat": farm.lat,
                    "lng": farm.lng,
                    "status": Sensor.Status.ONLINE,
                    "installed_at": now - timedelta(days=200),
                    "last_seen": now - timedelta(minutes=4),
                },
            )
            self._readings(sensor, base=base, amplitude=4, now=now)
            sensors.append(sensor)
        return sensors

    def _readings(self, sensor, base, amplitude, now):
        if SensorReading.objects.filter(sensor=sensor).count() >= 36:
            return
        for hours_ago in range(72, 0, -2):
            recorded = now - timedelta(hours=hours_ago)
            wobble = RNG.uniform(-amplitude, amplitude)
            SensorReading.objects.create(
                sensor=sensor,
                value=Decimal(str(round(max(0, base + wobble), 2))),
                recorded_at=recorded,
                quality=SensorReading.Quality.GOOD,
            )

    def _weather(self, north, cedar, sensors):
        now = timezone.now()
        for farm, name in ((north, "North Ridge Station"), (cedar, "Cedar Creek Station")):
            station, _ = WeatherStation.objects.update_or_create(
                farm=farm,
                name=name,
                defaults={
                    "lat": farm.lat,
                    "lng": farm.lng,
                    "source": WeatherStation.Source.DEVICE,
                    "is_active": True,
                },
            )
            if WeatherReading.objects.filter(station=station).count() < 24:
                for hours_ago in range(48, 0, -2):
                    WeatherReading.objects.create(
                        station=station,
                        temperature_c=Decimal(str(round(18 + RNG.uniform(-4, 8), 1))),
                        humidity_pct=Decimal(str(round(55 + RNG.uniform(-10, 20), 1))),
                        rainfall_mm=Decimal(str(round(max(0, RNG.uniform(-0.5, 2.2)), 1))),
                        wind_kph=Decimal(str(round(8 + RNG.uniform(0, 12), 1))),
                        pressure_hpa=Decimal("1013.20"),
                        recorded_at=now - timedelta(hours=hours_ago),
                    )
            for i in range(7):
                day = now.date() + timedelta(days=i)
                WeatherForecast.objects.update_or_create(
                    farm=farm,
                    forecast_date=day,
                    defaults={
                        "high_c": Decimal(str(24 + i % 4)),
                        "low_c": Decimal(str(11 + i % 3)),
                        "precip_chance": Decimal(str(20 + i * 5)),
                        "precip_mm": Decimal(str(i)),
                        "conditions": "partly cloudy" if i % 2 == 0 else "clear",
                        "wind_kph": Decimal("14.00"),
                    },
                )
        WeatherAlert.objects.get_or_create(
            farm=north,
            alert_type=WeatherAlert.AlertType.HEAT,
            title="Afternoon heat building",
            defaults={
                "severity": WeatherAlert.Severity.MEDIUM,
                "message": "Highs near 33°C over the next two days. Watch moisture on North 80.",
                "starts_at": now,
                "ends_at": now + timedelta(days=2),
                "is_active": True,
            },
        )

    def _inventory(self, org, north, cedar, owner):
        specs = [
            (north, "DKC 62-08 seed", "SEED-CORN-6208", "seeds", "bag", 48, 12, 285, "Bin A"),
            (north, "UAN 32%", "FERT-UAN-32", "fertilizers", "gal", 620, 200, 2.1, "Nurse tank 1"),
            (north, "Glyphosate 4lb", "CHEM-GLY-4", "chemicals", "gal", 18, 20, 22.5, "Chem shed"),
            (north, "Diesel", "FUEL-DSL", "fuel", "gal", 840, 200, 3.4, "Yard tank"),
            (cedar, "Tomato transplants", "SEED-TOM-MM", "seeds", "flat", 12, 8, 18, "Greenhouse"),
            (cedar, "Harvested soybeans", "HV-SOY-25", "harvested", "bu", 1200, 0, 12.8, "Bin 4"),
        ]
        for farm, name, sku, category, unit, qty, reorder, cost, location in specs:
            item, created = InventoryItem.objects.update_or_create(
                organization=org,
                sku=sku,
                defaults={
                    "farm": farm,
                    "name": name,
                    "category": category,
                    "unit": unit,
                    "quantity": Decimal(qty),
                    "reorder_level": Decimal(reorder),
                    "unit_cost": Decimal(str(cost)),
                    "location": location,
                    "lot_number": "L-2026-09",
                },
            )
            if created or not item.movements.exists():
                StockMovement.objects.create(
                    item=item,
                    quantity_delta=Decimal(qty),
                    movement_type=StockMovement.MovementType.IN,
                    reference="opening-balance",
                    created_by=owner,
                )

    def _equipment(self, north, cedar, operator):
        tractor, _ = Equipment.objects.update_or_create(
            farm=north,
            serial="JD-8R-4410",
            defaults={
                "name": "John Deere 8R",
                "equipment_type": Equipment.EquipmentType.TRACTOR,
                "manufacturer": "John Deere",
                "model": "8R 340",
                "year": 2022,
                "hours": Decimal("1840.0"),
                "status": Equipment.Status.OPERATIONAL,
                "lat": north.lat,
                "lng": north.lng,
                "fuel_capacity": Decimal("180"),
                "assigned_field": north.fields.first(),
            },
        )
        pivot, _ = Equipment.objects.update_or_create(
            farm=north,
            serial="VRI-PIVOT-01",
            defaults={
                "name": "North 80 Pivot",
                "equipment_type": Equipment.EquipmentType.IRRIGATION_SYSTEM,
                "manufacturer": "Valley",
                "model": "8000",
                "year": 2019,
                "hours": Decimal("6200.0"),
                "status": Equipment.Status.OPERATIONAL,
                "lat": Decimal("41.628000"),
                "lng": Decimal("-93.628000"),
            },
        )
        sprayer, _ = Equipment.objects.update_or_create(
            farm=cedar,
            serial="CASE-SPX-11",
            defaults={
                "name": "Case Patriot sprayer",
                "equipment_type": Equipment.EquipmentType.SPRAYER,
                "manufacturer": "Case IH",
                "model": "Patriot 4440",
                "year": 2018,
                "hours": Decimal("2105.0"),
                "status": Equipment.Status.MAINTENANCE,
                "lat": cedar.lat,
                "lng": cedar.lng,
            },
        )
        for eq, title, nxt in ((tractor, "Engine oil & filters", 1900), (pivot, "Gearbox grease", 6300), (sprayer, "Nozzle rebuild", 2050)):
            MaintenanceSchedule.objects.update_or_create(
                equipment=eq,
                title=title,
                defaults={
                    "interval_hours": 250,
                    "last_service_hours": Decimal(str(nxt - 250)),
                    "next_due_hours": Decimal(nxt),
                    "next_due_date": date(2026, 9, 20),
                    "is_active": True,
                },
            )
        FuelLog.objects.get_or_create(
            equipment=tractor,
            logged_at=timezone.now() - timedelta(days=1),
            defaults={"gallons": Decimal("64.00"), "cost": Decimal("217.00"), "hours": tractor.hours, "notes": "Field day"},
        )
        Breakdown.objects.get_or_create(
            equipment=sprayer,
            title="Boom section solenoid",
            defaults={
                "description": "Right boom section not actuating.",
                "severity": Breakdown.Severity.MEDIUM,
                "reported_at": timezone.now() - timedelta(days=2),
                "status": Breakdown.Status.IN_PROGRESS,
                "reported_by": operator,
            },
        )
        ServiceHistory.objects.get_or_create(
            equipment=tractor,
            service_date=date(2026, 7, 12),
            defaults={
                "description": "250-hour service",
                "cost": Decimal("640.00"),
                "hours_at_service": Decimal("1600.0"),
                "vendor": "GreenLine Implement",
            },
        )

    def _scouting(self, fields, owner, operator):
        report, created = ScoutReport.objects.get_or_create(
            field=fields[0],
            report_date=date(2026, 9, 4),
            defaults={
                "scout": operator,
                "overall_health": ScoutReport.Health.GOOD,
                "growth_stage": "R3",
                "notes": "Canopy looks even. Minor gray leaf spot on lower leaves.",
                "weather_snapshot": {"temp_c": 27, "humidity": 62},
            },
        )
        if created:
            DiseaseObservation.objects.create(
                report=report, disease_name="Gray leaf spot", severity=2, area_affected_pct=Decimal("4.00")
            )
            PestIncident.objects.create(
                report=report, pest_name="Corn rootworm", severity=1, population_estimate="low"
            )
            WeedPressure.objects.create(
                report=report, weed_name="Waterhemp", severity=2, coverage_pct=Decimal("3.50")
            )
        ScoutReport.objects.get_or_create(
            field=fields[3],
            report_date=date(2026, 9, 6),
            defaults={
                "scout": owner,
                "overall_health": ScoutReport.Health.FAIR,
                "growth_stage": "fruit set",
                "notes": "Early blight starting on lower canopy.",
                "weather_snapshot": {"temp_c": 29, "humidity": 70},
            },
        )
        TreatmentPlan.objects.get_or_create(
            field=fields[3],
            product_name="Chlorothalonil",
            defaults={
                "issue_summary": "Early blight on tomatoes",
                "rate": "1.5 pt/ac",
                "scheduled_date": date(2026, 9, 12),
                "follow_up_date": date(2026, 9, 19),
                "status": TreatmentPlan.Status.PLANNED,
                "assigned_to": operator,
                "notes": "Spray early morning.",
            },
        )
        FieldNote.objects.get_or_create(
            field=fields[0],
            content="Check pivot end gun overlap after next cycle.",
            defaults={"author": owner, "note_type": FieldNote.NoteType.INSTRUCTION},
        )

    def _platform(self, org, farm, fields, owner, manager, operator):
        Task.objects.get_or_create(
            organization=org,
            title="Scout North 80 for GLS",
            defaults={
                "farm": farm,
                "field": fields[0],
                "description": "Walk the west edge and photograph any lesions.",
                "status": Task.Status.IN_PROGRESS,
                "priority": Task.Priority.HIGH,
                "due_date": date(2026, 9, 12),
                "assignee": operator,
                "created_by": manager,
            },
        )
        Task.objects.get_or_create(
            organization=org,
            title="Order UAN before sidedress",
            defaults={
                "farm": farm,
                "description": "Inventory of UAN is adequate but confirm nurse tank delivery.",
                "status": Task.Status.TODO,
                "priority": Task.Priority.MEDIUM,
                "due_date": date(2026, 9, 15),
                "assignee": manager,
                "created_by": owner,
            },
        )
        for user, title in (
            (owner, "Welcome to Green Valley Cooperative"),
            (manager, "Sensor North 80 moisture is online"),
            (operator, "Irrigation recommended on Creek Side"),
        ):
            Notification.objects.get_or_create(
                user=user,
                organization=org,
                title=title,
                defaults={
                    "body": "Demo data is ready for the AgriNexa dashboard.",
                    "category": "system",
                    "link": "/dashboard",
                    "payload": {},
                },
            )
