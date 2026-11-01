"""Crop-planning engine.

Pure-ish domain logic for planting windows, variety selection, rotation
compliance, resource constraints, and strategy evaluation/comparison. Views
call into this module; nothing here depends on the request cycle.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field as dc_field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from apps.crops.models import (
    Crop,
    CropPlan,
    CropPlanComponent,
    CropVariety,
    FarmingStrategy,
    GrowingSeason,
    PlantingSystem,
    PlantingWindow,
    ResourceConstraint,
    RotationPlan,
    RotationStep,
    StrategyAllocation,
)
from apps.farms.models import CropHistory, Field

ZERO = Decimal("0")
TWO_PLACES = Decimal("0.01")


def _d(value, default=ZERO) -> Decimal:
    if value is None or value == "":
        return default
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:  # pragma: no cover - defensive
        return default


def _q(value: Decimal) -> float:
    return float(_d(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP))



def warning(code: str, message: str, **params) -> dict:
    """A machine-translatable planning warning.

    Returns the code and its parameters alongside an English `message`. The SPA
    renders from `code`, which lets each language choose its own word order,
    date format, and plural rules — none of which survive an interpolated
    English sentence. Non-UI consumers and logs keep reading `message`.
    """
    return {"code": code, "params": params, "message": message}


# ─────────────────────────────────────────────────────────────────────────────
# Planting windows
# ─────────────────────────────────────────────────────────────────────────────

# Fallback windows when an organization has not defined any: Northern-
# hemisphere temperate defaults keyed by crop category.
DEFAULT_WINDOWS = {
    "grain": ((4, 15), (5, 20), (6, 10), (10, 25)),
    "oilseed": ((5, 1), (6, 1), (6, 20), (10, 20)),
    "legume": ((5, 1), (6, 5), (6, 25), (10, 15)),
    "vegetable": ((5, 10), (6, 15), (7, 1), (10, 1)),
    "fruit": ((4, 1), (5, 15), (6, 1), (10, 15)),
    "forage": ((4, 1), (5, 15), (8, 31), (11, 1)),
    "fiber": ((4, 20), (5, 25), (6, 10), (10, 31)),
    "cover": ((8, 15), (10, 1), (10, 31), None),
    "other": ((4, 15), (6, 1), (6, 30), (10, 31)),
}


def resolve_window(crop: Crop, variety: CropVariety | None, farm, year: int) -> dict:
    """Most-specific planting window for a crop/variety on a farm in `year`."""
    qs = PlantingWindow.objects.filter(crop=crop, organization_id=crop.organization_id)
    candidates = list(qs.select_related("variety", "farm"))

    def rank(w: PlantingWindow) -> tuple:
        return (
            1 if (variety and w.variety_id == variety.id) else 0,
            1 if (farm is not None and w.farm_id == getattr(farm, "id", None)) else 0,
            # Generic windows (no variety, no farm) are valid fallbacks; variety-
            # or farm-specific windows for *other* targets are not.
            0 if (w.variety_id and (not variety or w.variety_id != variety.id)) else 1,
            0 if (w.farm_id and (farm is None or w.farm_id != getattr(farm, "id", None))) else 1,
        )

    valid = [w for w in candidates if rank(w)[2] and rank(w)[3]]
    if valid:
        best = max(valid, key=rank)
        out = best.resolve(year)
        out["defined"] = True
        return out

    start, end, late, harvest_by = DEFAULT_WINDOWS.get(crop.category, DEFAULT_WINDOWS["other"])
    mk = lambda md: date(year, md[0], md[1]) if md else None  # noqa: E731
    return {
        "start": mk(start),
        "end": mk(end),
        "late_end": mk(late),
        "harvest_by": mk(harvest_by),
        "min_soil_temp_c": None,
        "source": "category default",
        "window_id": None,
        "defined": False,
    }


def days_to_maturity(crop: Crop, variety: CropVariety | None) -> int:
    if variety and variety.days_to_maturity:
        return int(variety.days_to_maturity)
    return int(crop.typical_days or 120)


def previous_occupant(field: Field, season: GrowingSeason, exclude_plan_id=None):
    """The plan whose harvest most recently precedes this season on `field`."""
    qs = (
        CropPlan.objects.filter(field=field)
        .exclude(status=CropPlan.Status.CANCELLED)
        .select_related("crop", "season")
        .order_by("-expected_harvest_date", "-planting_date")
    )
    if exclude_plan_id:
        qs = qs.exclude(pk=exclude_plan_id)
    for plan in qs:
        if plan.season_id == season.id:
            continue
        if plan.expected_harvest_date and plan.expected_harvest_date <= season.end_date:
            return plan
    return None


def assess_planting(
    field: Field,
    crop: Crop,
    variety: CropVariety | None,
    planting_date: date | None,
    season: GrowingSeason,
    exclude_plan_id=None,
) -> dict:
    """Grade a planting date against the window, harvest deadline, soil, and
    the field's previous occupant."""
    farm = field.farm
    year = (planting_date or season.start_date).year
    window = resolve_window(crop, variety, farm, year)
    dtm = days_to_maturity(crop, variety)
    warnings: list[str] = []
    fit = "unknown"
    harvest_date = None
    harvest_ok = None

    if planting_date:
        harvest_date = planting_date + timedelta(days=dtm)
        if window["start"] and window["end"]:
            if planting_date < window["start"]:
                fit = "early"
                days_early = (window["start"] - planting_date).days
                warnings.append(
                    warning(
                        "planting.before_window",
                        f"Planting {days_early} days before the window opens "
                        f"({window['start']:%b %d}); cold soil and frost risk.",
                        days=days_early,
                        window_start=window["start"].isoformat(),
                    )
                )
            elif planting_date <= window["end"]:
                fit = "optimal"
            elif window["late_end"] and planting_date <= window["late_end"]:
                fit = "late"
                warnings.append(
                    warning(
                        "planting.past_optimal",
                        f"Past the optimal window ({window['end']:%b %d}); expect a yield penalty.",
                        window_end=window["end"].isoformat(),
                    )
                )
            else:
                fit = "outside"
                closes = window["late_end"] or window["end"]
                warnings.append(
                    warning(
                        "planting.outside_window",
                        f"Outside the acceptable window (closes {closes:%b %d}).",
                        closes=closes.isoformat(),
                    )
                )
        if window["harvest_by"]:
            harvest_ok = harvest_date <= window["harvest_by"]
            if not harvest_ok:
                warnings.append(
                    warning(
                        "planting.harvest_too_late",
                        f"Projected harvest {harvest_date:%b %d} is after the harvest-by date "
                        f"{window['harvest_by']:%b %d}; choose an earlier variety or plant sooner.",
                        harvest=harvest_date.isoformat(),
                        harvest_by=window["harvest_by"].isoformat(),
                    )
                )
        if season.end_date and harvest_date > season.end_date:
            warnings.append(
                warning(
                    "planting.harvest_after_season",
                    f"Harvest {harvest_date:%b %d} falls after the season ends {season.end_date:%b %d}.",
                    harvest=harvest_date.isoformat(),
                    season_end=season.end_date.isoformat(),
                )
            )

    # Soil suitability
    soil_match = None
    if variety and variety.suitable_soils:
        soil_match = (field.soil_type or "") in variety.suitable_soils
        if not soil_match:
            warnings.append(
                warning(
                    "variety.soil_mismatch",
                    f"{variety.name} is not rated for {field.soil_type or 'this soil'} "
                    f"(suits: {', '.join(variety.suitable_soils)}).",
                    variety=variety.name,
                    soil=field.soil_type or "",
                    suits=", ".join(variety.suitable_soils),
                )
            )

    # Irrigation vs water need
    irrigation = getattr(field, "irrigation_type", "none") or "none"
    if crop.water_need == Crop.WaterNeed.HIGH and irrigation == "none":
        tol = variety.drought_tolerance if variety else 3
        if tol < 4:
            warnings.append(
                warning(
                    "crop.high_water_dryland",
                    "High-water crop on a dryland field; consider a drought-tolerant variety or irrigation.",
                    crop=crop.name,
                )
            )

    # Previous occupant conflict + rotation
    prev = previous_occupant(field, season, exclude_plan_id=exclude_plan_id)
    conflicts: list[dict] = []
    if prev and planting_date and prev.expected_harvest_date and prev.expected_harvest_date >= planting_date:
        conflicts.append(
            {
                "plan_id": str(prev.id),
                "crop_name": prev.crop.name,
                "harvest_date": prev.expected_harvest_date.isoformat(),
                "code": "planting.previous_crop_in_ground",
                "params": {
                    "crop": prev.crop.name,
                    "harvest_date": prev.expected_harvest_date.isoformat(),
                },
                "message": f"{prev.crop.name} is still in the ground until {prev.expected_harvest_date:%b %d}.",
            }
        )
    rotation = rotation_check(field, crop, season)
    warnings.extend(rotation["warnings"])

    return {
        "fit": fit,
        "window": {
            **{k: (v.isoformat() if isinstance(v, date) else v) for k, v in window.items()},
            "min_soil_temp_c": _q(window["min_soil_temp_c"]) if window["min_soil_temp_c"] is not None else None,
        },
        "days_to_maturity": dtm,
        "projected_harvest": harvest_date.isoformat() if harvest_date else None,
        "harvest_ok": harvest_ok,
        "soil_match": soil_match,
        "previous_crop": prev.crop.name if prev else None,
        "conflicts": conflicts,
        "rotation": rotation,
        "warnings": warnings,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Rotation compliance
# ─────────────────────────────────────────────────────────────────────────────

HEAVY_FEEDER_CATEGORIES = {"grain", "vegetable", "fiber"}


def _field_crop_lineage(field: Field, before: GrowingSeason | None, limit=4) -> list[dict]:
    """Most-recent-first list of crops grown on `field` (plans then history)."""
    out: list[dict] = []
    plans = (
        CropPlan.objects.filter(field=field)
        .exclude(status=CropPlan.Status.CANCELLED)
        .select_related("crop", "season")
        .order_by("-season__start_date", "-planting_date")
    )
    if before is not None:
        plans = plans.filter(season__start_date__lt=before.start_date)
    for p in plans[:limit]:
        out.append({"crop": p.crop, "name": p.crop.name, "year": p.season.year, "source": "plan"})
    if len(out) < limit:
        names = {c.name.lower(): c for c in Crop.objects.filter(organization_id=field.farm.organization_id)}
        hist = CropHistory.objects.filter(field=field).order_by("-planted_at", "-created_at")
        if before is not None:
            hist = hist.filter(planted_at__lt=before.start_date)
        for h in hist[: limit - len(out)]:
            crop = names.get((h.crop_name or "").lower())
            out.append(
                {
                    "crop": crop,
                    "name": h.crop_name,
                    "year": h.planted_at.year if h.planted_at else None,
                    "source": "history",
                }
            )
    return out


def rotation_check(field: Field, crop: Crop, season: GrowingSeason) -> dict:
    """Score 0–100 for how well `crop` follows what the field grew before."""
    lineage = _field_crop_lineage(field, season)
    score = 100
    warnings: list[str] = []
    notes: list[str] = []
    if not lineage:
        return {"score": score, "lineage": [], "warnings": warnings, "notes": ["No prior crop record."]}

    prev = lineage[0]
    prev_crop: Crop | None = prev["crop"]
    if prev["name"].lower() == crop.name.lower():
        score -= 40
        warnings.append(
            warning(
                "rotation.continuous_cropping",
                f"{crop.name} follows {crop.name}; continuous cropping builds pest and disease pressure.",
                crop=crop.name,
            )
        )
    elif prev_crop and crop.family and prev_crop.family and prev_crop.family == crop.family:
        score -= 25
        warnings.append(
            warning(
                "rotation.same_family",
                f"{crop.name} follows {prev['name']} (same family {crop.family}); shared pathogens.",
                crop=crop.name,
                previous=prev["name"],
                family=crop.family,
            )
        )
    if prev_crop and prev_crop.nitrogen_fixing and crop.category in HEAVY_FEEDER_CATEGORIES:
        score = min(100, score + 10)
        notes.append(
            warning(
                "rotation.legume_credit",
                f"Legume credit: {prev['name']} before {crop.name} offsets nitrogen demand.",
                crop=crop.name,
                previous=prev["name"],
            )
        )
    if prev_crop and prev_crop.root_depth == crop.root_depth and prev_crop.root_depth != "medium":
        score -= 5
        notes.append(
            warning(
                "rotation.same_root_depth",
                "Consecutive crops share rooting depth; alternate deep and shallow to use the profile.",
            )
        )
    # Frequency in the last four seasons
    same = sum(1 for x in lineage if x["name"].lower() == crop.name.lower())
    if same >= 2:
        score -= 15
        warnings.append(
            warning(
                "rotation.too_frequent",
                f"{crop.name} appeared {same} times in the last {len(lineage)} seasons.",
                crop=crop.name,
                count=same,
                seasons=len(lineage),
            )
        )
    return {
        "score": max(0, score),
        "lineage": [{"name": x["name"], "year": x["year"], "source": x["source"]} for x in lineage],
        "warnings": warnings,
        "notes": notes,
    }


def rotation_validate(rotation: RotationPlan) -> dict:
    """Static checks on a rotation's step sequence (cyclic)."""
    steps = list(rotation.steps.select_related("crop").order_by("year_offset", "order"))
    mains = [s for s in steps if s.role == RotationStep.Role.MAIN and s.crop]
    issues: list[dict] = []
    if not mains:
        return {
            "ok": False,
            "issues": [
                {"level": "error", **warning("rotation.no_main_steps", "Rotation has no main-crop steps.")}
            ],
        }
    for i, step in enumerate(mains):
        nxt = mains[(i + 1) % len(mains)]
        if len(mains) > 1 and step.crop_id == nxt.crop_id:
            issues.append(
                {
                    "level": "warning",
                    "year_offset": nxt.year_offset,
                    **warning(
                        "rotation.repeats_back_to_back",
                        f"{step.crop.name} repeats back-to-back.",
                        crop=step.crop.name,
                    ),
                }
            )
        elif step.crop.family and step.crop.family == nxt.crop.family and step.crop_id != nxt.crop_id:
            issues.append(
                {
                    "level": "warning",
                    "year_offset": nxt.year_offset,
                    **warning(
                        "rotation.consecutive_family",
                        f"{step.crop.name} → {nxt.crop.name} are both {step.crop.family}.",
                        crop=step.crop.name,
                        next=nxt.crop.name,
                        family=step.crop.family,
                    ),
                }
            )
    if not any(s.crop.nitrogen_fixing for s in mains):
        issues.append(
            {
                "level": "info",
                **warning(
                    "rotation.no_legume",
                    "No nitrogen-fixing crop in the cycle; expect higher N inputs.",
                ),
            }
        )
    families = {s.crop.family or s.crop.name for s in mains}
    diversity = len(families) / len(mains)
    return {
        "ok": not any(i["level"] == "error" for i in issues),
        "cycle_years": rotation.cycle_years,
        "diversity": round(diversity, 2),
        "issues": issues,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Variety recommendation
# ─────────────────────────────────────────────────────────────────────────────


def recommend_varieties(
    field: Field, crop: Crop, planting_date: date | None, season: GrowingSeason, limit: int = 10
) -> list[dict]:
    """Rank a crop's varieties for a field and planting date."""
    farm = field.farm
    year = (planting_date or season.start_date).year
    irrigation = getattr(field, "irrigation_type", "none") or "none"
    out: list[dict] = []
    for v in crop.varieties.filter(is_active=True):
        reasons: list[str] = []
        score = 50.0
        window = resolve_window(crop, v, farm, year)
        dtm = days_to_maturity(crop, v)
        if planting_date:
            harvest = planting_date + timedelta(days=dtm)
            if window["harvest_by"]:
                slack = (window["harvest_by"] - harvest).days
                if slack < 0:
                    score -= 30
                    reasons.append(f"Matures {abs(slack)} days after the harvest-by date.")
                elif slack < 10:
                    score += 5
                    reasons.append("Uses the full season.")
                else:
                    score += min(15, slack / 3)
                    reasons.append(f"{slack} days of harvest slack.")
            if window["late_end"] and planting_date > window["late_end"]:
                score -= 15
                reasons.append("Planting date is past this variety's window.")
        if v.suitable_soils:
            if (field.soil_type or "") in v.suitable_soils:
                score += 12
                reasons.append(f"Rated for {field.soil_type}.")
            else:
                score -= 12
                reasons.append(f"Not rated for {field.soil_type or 'this soil'}.")
        if irrigation == "none":
            score += (v.drought_tolerance - 3) * 6
            if v.drought_tolerance >= 4:
                reasons.append("Drought tolerant on a dryland field.")
            elif v.drought_tolerance <= 2:
                reasons.append("Low drought tolerance without irrigation.")
        yld = _d(v.effective_yield)
        crop_yld = _d(crop.expected_yield_per_acre)
        if crop_yld > 0 and yld > 0:
            rel = float((yld - crop_yld) / crop_yld)
            score += max(-10, min(15, rel * 50))
            if rel > 0.05:
                reasons.append(f"Yield {rel * 100:+.0f}% vs crop average.")
        seed_cost = _d(v.effective_seed_cost)
        if crop.seed_cost_per_acre and seed_cost:
            rel_cost = float((seed_cost - _d(crop.seed_cost_per_acre)) / _d(crop.seed_cost_per_acre))
            score -= max(-5, min(10, rel_cost * 20))
        if v.disease_resistance:
            score += min(8, 2 * len(v.disease_resistance))
            reasons.append(f"Resists {', '.join(v.disease_resistance[:3])}.")
        price = _d(crop.expected_price_per_unit)
        margin = yld * price - seed_cost - _d(crop.input_cost_per_acre)
        out.append(
            {
                "variety_id": str(v.id),
                "name": v.name,
                "maturity_group": v.maturity_group,
                "days_to_maturity": dtm,
                "drought_tolerance": v.drought_tolerance,
                "expected_yield_per_acre": _q(yld),
                "yield_unit": v.yield_unit or crop.yield_unit,
                "seed_cost_per_acre": _q(seed_cost),
                "projected_margin_per_acre": _q(margin),
                "projected_harvest": (planting_date + timedelta(days=dtm)).isoformat() if planting_date else None,
                "score": round(max(0.0, min(100.0, score)), 1),
                "reasons": reasons,
            }
        )
    out.sort(key=lambda r: (-r["score"], r["name"]))
    return out[:limit]


# ─────────────────────────────────────────────────────────────────────────────
# Economics & resources per allocation
# ─────────────────────────────────────────────────────────────────────────────

RAINFALL_WATER_FACTOR = {"dry": Decimal("1.25"), "normal": Decimal("1.00"), "wet": Decimal("0.80")}
RAINFALL_YIELD_FACTOR = {"dry": Decimal("0.90"), "normal": Decimal("1.00"), "wet": Decimal("0.97")}


@dataclass
class Metrics:
    acres: Decimal = ZERO
    production: Decimal = ZERO
    revenue: Decimal = ZERO
    seed_cost: Decimal = ZERO
    input_cost: Decimal = ZERO
    labor_hours: Decimal = ZERO
    water_acre_inches: Decimal = ZERO
    nitrogen_demand_lb: Decimal = ZERO
    nitrogen_fixed_lb: Decimal = ZERO
    crop_acres: dict = dc_field(default_factory=lambda: defaultdict(Decimal))
    crop_units: dict = dc_field(default_factory=dict)

    @property
    def total_cost(self) -> Decimal:
        return self.seed_cost + self.input_cost

    @property
    def margin(self) -> Decimal:
        return self.revenue - self.total_cost

    def add(self, other: "Metrics"):
        for attr in (
            "acres",
            "production",
            "revenue",
            "seed_cost",
            "input_cost",
            "labor_hours",
            "water_acre_inches",
            "nitrogen_demand_lb",
            "nitrogen_fixed_lb",
        ):
            setattr(self, attr, getattr(self, attr) + getattr(other, attr))
        for k, v in other.crop_acres.items():
            self.crop_acres[k] += v
        self.crop_units.update(other.crop_units)

    def as_dict(self) -> dict:
        acres = self.acres or Decimal("1")
        return {
            "acres": _q(self.acres),
            "production": _q(self.production),
            "revenue": _q(self.revenue),
            "seed_cost": _q(self.seed_cost),
            "input_cost": _q(self.input_cost),
            "total_cost": _q(self.total_cost),
            "margin": _q(self.margin),
            "margin_per_acre": _q(self.margin / acres) if self.acres else 0.0,
            "labor_hours": _q(self.labor_hours),
            "water_acre_inches": _q(self.water_acre_inches),
            "nitrogen_demand_lb": _q(self.nitrogen_demand_lb),
            "nitrogen_fixed_lb": _q(self.nitrogen_fixed_lb),
            "nitrogen_balance_lb": _q(self.nitrogen_fixed_lb - self.nitrogen_demand_lb),
            "crop_acres": {k: _q(v) for k, v in self.crop_acres.items()},
        }


# Approximate N credit (lb/acre) a nitrogen-fixing crop leaves for the following crop.
LEGUME_N_CREDIT_LB = Decimal("40")


def component_metrics(
    crop: Crop,
    variety: CropVariety | None,
    acres: Decimal,
    *,
    price_mult=Decimal("1"),
    yield_mult=Decimal("1"),
    cost_mult=Decimal("1"),
    rainfall="normal",
) -> Metrics:
    m = Metrics()
    acres = _d(acres)
    if acres <= 0:
        return m
    yld = _d(variety.effective_yield if variety else crop.expected_yield_per_acre)
    yld = yld * _d(yield_mult) * RAINFALL_YIELD_FACTOR.get(rainfall, Decimal("1"))
    price = _d(crop.expected_price_per_unit) * _d(price_mult)
    seed = _d(variety.effective_seed_cost if variety else crop.seed_cost_per_acre) * _d(cost_mult)
    inputs = _d(crop.input_cost_per_acre) * _d(cost_mult)
    m.acres = acres
    m.production = yld * acres
    m.revenue = m.production * price
    m.seed_cost = seed * acres
    m.input_cost = inputs * acres
    m.labor_hours = _d(crop.labor_hours_per_acre) * acres
    m.water_acre_inches = crop.effective_water_inches * RAINFALL_WATER_FACTOR.get(rainfall, Decimal("1")) * acres
    m.nitrogen_demand_lb = _d(crop.nitrogen_lb_per_acre) * acres
    if crop.nitrogen_fixing:
        m.nitrogen_fixed_lb = LEGUME_N_CREDIT_LB * acres
    m.crop_acres[crop.name] += acres
    m.crop_units[crop.name] = variety.yield_unit if variety and variety.yield_unit else crop.yield_unit
    return m


def _resolve_components(primary_crop, primary_variety, components: list[dict], crops: dict, varieties: dict):
    """Normalise a mixed-cropping component list into (crop, variety, share) tuples.

    Shares are percentages of the field. If they do not sum to 100 the
    remainder is given to the primary crop; if there are no components the
    primary takes the whole field.
    """
    resolved: list[tuple] = []
    total = ZERO
    for c in components or []:
        crop = crops.get(str(c.get("crop")))
        if not crop:
            continue
        variety = varieties.get(str(c.get("variety"))) if c.get("variety") else None
        share = _d(c.get("share_pct"), ZERO)
        if share <= 0:
            continue
        resolved.append((crop, variety, share))
        total += share
    if primary_crop:
        remainder = Decimal("100") - total
        if remainder > 0:
            resolved.insert(0, (primary_crop, primary_variety, remainder))
    # Normalise if over-subscribed
    total = sum(s for _, _, s in resolved) or Decimal("100")
    return [(c, v, s / total) for c, v, s in resolved]


def allocation_metrics(alloc: StrategyAllocation, strategy: FarmingStrategy, crops: dict, varieties: dict) -> Metrics:
    acres = alloc.effective_acres
    parts = _resolve_components(alloc.crop, alloc.variety, alloc.components, crops, varieties)
    m = Metrics()
    for crop, variety, frac in parts:
        m.add(
            component_metrics(
                crop,
                variety,
                acres * frac,
                price_mult=strategy.price_multiplier,
                yield_mult=strategy.yield_multiplier,
                cost_mult=strategy.cost_multiplier,
                rainfall=strategy.rainfall_scenario,
            )
        )
    # Intercropping typically yields a land-equivalent-ratio above 1; apply a
    # conservative 8% uplift to revenue for true intercrops/relays.
    if alloc.planting_system in (PlantingSystem.INTERCROP, PlantingSystem.RELAY) and len(parts) > 1:
        m.revenue = m.revenue * Decimal("1.08")
    return m


def plan_metrics(plan: CropPlan, crops: dict, varieties: dict) -> Metrics:
    acres = plan.effective_acres
    comps = [
        {"crop": str(c.crop_id), "variety": str(c.variety_id) if c.variety_id else None, "share_pct": c.share_pct}
        for c in plan.components.all()
        if c.role != CropPlanComponent.Role.PRIMARY
    ]
    parts = _resolve_components(plan.crop, plan.variety, comps, crops, varieties)
    m = Metrics()
    for crop, variety, frac in parts:
        m.add(component_metrics(crop, variety, acres * frac))
    return m


# ─────────────────────────────────────────────────────────────────────────────
# Constraints
# ─────────────────────────────────────────────────────────────────────────────


def _constraint_usage(resource: str, m: Metrics) -> Decimal:
    return {
        ResourceConstraint.Resource.WATER: m.water_acre_inches,
        ResourceConstraint.Resource.LABOR: m.labor_hours,
        ResourceConstraint.Resource.NITROGEN: max(ZERO, m.nitrogen_demand_lb - m.nitrogen_fixed_lb),
        ResourceConstraint.Resource.SEED_BUDGET: m.seed_cost,
        ResourceConstraint.Resource.INPUT_BUDGET: m.input_cost,
        ResourceConstraint.Resource.TOTAL_BUDGET: m.total_cost,
        ResourceConstraint.Resource.ACRES: m.acres,
        ResourceConstraint.Resource.EQUIPMENT: m.labor_hours * Decimal("0.6"),
    }.get(resource, ZERO)


def applicable_constraints(organization_id, farm_id, season_id):
    """Constraints for a farm-season, with farm/season-specific rows taking
    precedence over organization-wide ones for the same resource."""
    qs = ResourceConstraint.objects.filter(organization_id=organization_id)
    rows = [
        c
        for c in qs
        if (c.farm_id is None or c.farm_id == farm_id) and (c.season_id is None or c.season_id == season_id)
    ]
    best: dict[str, ResourceConstraint] = {}
    for c in rows:
        specificity = (c.farm_id is not None) + (c.season_id is not None)
        cur = best.get(c.resource)
        if cur is None or specificity > ((cur.farm_id is not None) + (cur.season_id is not None)):
            best[c.resource] = c
    return list(best.values())


def evaluate_constraints(m: Metrics, constraints) -> list[dict]:
    out = []
    for c in constraints:
        used = _constraint_usage(c.resource, m)
        limit = _d(c.limit_value)
        pct = float(used / limit * 100) if limit > 0 else 0.0
        status = "ok"
        if used > limit:
            status = "violated" if c.is_hard else "exceeded"
        elif pct >= 90:
            status = "tight"
        out.append(
            {
                "constraint_id": str(c.id),
                "resource": c.resource,
                "label": c.get_resource_display(),
                "unit": c.unit,
                "limit": _q(limit),
                "used": _q(used),
                "remaining": _q(limit - used),
                "utilization_pct": round(pct, 1),
                "is_hard": c.is_hard,
                "status": status,
                "scope": "farm-season" if (c.farm_id and c.season_id) else "farm" if c.farm_id else "season" if c.season_id else "organization",
            }
        )
    return out


def season_usage(season: GrowingSeason, farm=None) -> dict:
    """Resource usage of the *committed* plans for a season (and farm)."""
    plans = (
        CropPlan.objects.filter(season=season)
        .exclude(status=CropPlan.Status.CANCELLED)
        .select_related("crop", "variety", "field")
        .prefetch_related("components")
    )
    if farm is not None:
        plans = plans.filter(field__farm=farm)
    crops = {str(c.id): c for c in Crop.objects.filter(organization_id=season.organization_id)}
    varieties = {str(v.id): v for v in CropVariety.objects.filter(crop__organization_id=season.organization_id)}
    total = Metrics()
    for p in plans:
        total.add(plan_metrics(p, crops, varieties))
    constraints = applicable_constraints(season.organization_id, getattr(farm, "id", None), season.id)
    return {"metrics": total.as_dict(), "constraints": evaluate_constraints(total, constraints), "plan_count": plans.count()}


# ─────────────────────────────────────────────────────────────────────────────
# Strategy evaluation & comparison
# ─────────────────────────────────────────────────────────────────────────────


def shannon_diversity(acres_by_crop: dict) -> float:
    total = sum(acres_by_crop.values())
    if not total:
        return 0.0
    h = 0.0
    for a in acres_by_crop.values():
        if a > 0:
            p = float(a / total)
            h -= p * math.log(p)
    return round(h, 3)


def evaluate_strategy(strategy: FarmingStrategy, *, save: bool = True) -> dict:
    org_id = strategy.organization_id
    crops = {str(c.id): c for c in Crop.objects.filter(organization_id=org_id)}
    varieties = {str(v.id): v for v in CropVariety.objects.filter(crop__organization_id=org_id)}
    allocations = list(strategy.allocations.select_related("field", "field__farm", "crop", "variety"))

    total = Metrics()
    per_field: list[dict] = []
    warnings: list[str] = []
    rotation_scores: list[int] = []
    late_or_outside = 0

    for a in allocations:
        m = allocation_metrics(a, strategy, crops, varieties)
        total.add(m)
        row = {
            "allocation_id": str(a.id),
            "field_id": str(a.field_id),
            "field_name": a.field.name,
            "crop_name": a.crop.name if a.crop else "Fallow",
            "variety_name": a.variety.name if a.variety else None,
            "planting_system": a.planting_system,
            "components": [
                {
                    "crop_name": crops[str(c.get("crop"))].name if str(c.get("crop")) in crops else "?",
                    "share_pct": _q(_d(c.get("share_pct"))),
                    "role": c.get("role", "intercrop"),
                }
                for c in (a.components or [])
            ],
            **m.as_dict(),
        }
        if a.crop:
            assessment = assess_planting(a.field, a.crop, a.variety, a.planting_date, strategy.season)
            row["fit"] = assessment["fit"]
            row["rotation_score"] = assessment["rotation"]["score"]
            row["warnings"] = assessment["warnings"]
            rotation_scores.append(assessment["rotation"]["score"])
            if assessment["fit"] in ("late", "outside", "early"):
                late_or_outside += 1
            for w in assessment["warnings"]:
                warnings.append({**w, "field": a.field.name, "message": f"{a.field.name}: {w['message']}"})
        per_field.append(row)

    constraints = applicable_constraints(org_id, strategy.farm_id, strategy.season_id)
    constraint_results = evaluate_constraints(total, constraints)
    hard_violations = [c for c in constraint_results if c["status"] == "violated"]
    soft_exceeded = [c for c in constraint_results if c["status"] == "exceeded"]

    unplanted = Field.objects.filter(farm=strategy.farm).exclude(id__in=[a.field_id for a in allocations])
    unplanted_acres = sum((_d(f.acres) for f in unplanted), ZERO)

    diversity = shannon_diversity(total.crop_acres)
    rotation_score = round(sum(rotation_scores) / len(rotation_scores), 1) if rotation_scores else None

    # Risk: lower is better. Concentration, dryland high-water crops, late planting, N deficit.
    n_crops = len([k for k, v in total.crop_acres.items() if v > 0])
    concentration = 0.0
    if total.acres > 0:
        concentration = float(max(total.crop_acres.values(), default=ZERO) / total.acres)
    risk = 0.0
    risk += concentration * 40
    risk += (late_or_outside / len(allocations) * 25) if allocations else 0
    if total.nitrogen_demand_lb > 0:
        deficit = float(max(ZERO, total.nitrogen_demand_lb - total.nitrogen_fixed_lb) / total.nitrogen_demand_lb)
        risk += deficit * 15
    risk += min(20.0, len(hard_violations) * 10 + len(soft_exceeded) * 4)
    if strategy.rainfall_scenario == "dry":
        dryland_high = sum(
            _d(a.effective_acres)
            for a in allocations
            if a.crop and a.crop.water_need == "high" and (getattr(a.field, "irrigation_type", "none") or "none") == "none"
        )
        if total.acres > 0:
            risk += float(dryland_high / total.acres) * 20

    result = {
        "strategy_id": str(strategy.id),
        "name": strategy.name,
        "status": strategy.status,
        "is_baseline": strategy.is_baseline,
        "assumptions": {
            "price_multiplier": _q(strategy.price_multiplier),
            "yield_multiplier": _q(strategy.yield_multiplier),
            "cost_multiplier": _q(strategy.cost_multiplier),
            "rainfall_scenario": strategy.rainfall_scenario,
        },
        "totals": total.as_dict(),
        "crop_count": n_crops,
        "diversity_index": diversity,
        "rotation_score": rotation_score,
        "risk_score": round(min(100.0, risk), 1),
        "planting_fit": {
            "optimal": sum(1 for r in per_field if r.get("fit") == "optimal"),
            "late": sum(1 for r in per_field if r.get("fit") == "late"),
            "early": sum(1 for r in per_field if r.get("fit") == "early"),
            "outside": sum(1 for r in per_field if r.get("fit") == "outside"),
        },
        "constraints": constraint_results,
        "hard_violations": len(hard_violations),
        "soft_exceeded": len(soft_exceeded),
        "feasible": not hard_violations,
        "unplanted_fields": [{"id": str(f.id), "name": f.name, "acres": _q(_d(f.acres))} for f in unplanted],
        "unplanted_acres": _q(unplanted_acres),
        "fields": per_field,
        "warnings": warnings,
    }
    if save:
        strategy.evaluation = result
        strategy.evaluated_at = timezone.now()
        strategy.save(update_fields=["evaluation", "evaluated_at", "updated_at"])
    return result


COMPARE_METRICS = [
    # key path, label, higher_is_better
    (("totals", "revenue"), "Revenue", True),
    (("totals", "total_cost"), "Total cost", False),
    (("totals", "margin"), "Net margin", True),
    (("totals", "margin_per_acre"), "Margin / acre", True),
    (("totals", "production"), "Production", True),
    (("totals", "labor_hours"), "Labor hours", False),
    (("totals", "water_acre_inches"), "Water (ac-in)", False),
    (("totals", "nitrogen_balance_lb"), "Nitrogen balance", True),
    (("diversity_index",), "Diversity", True),
    (("rotation_score",), "Rotation score", True),
    (("risk_score",), "Risk", False),
    (("hard_violations",), "Hard violations", False),
]


def _dig(d: dict, path: tuple):
    cur = d
    for p in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def compare_strategies(strategies: list[FarmingStrategy], *, refresh: bool = True) -> dict:
    evals = [evaluate_strategy(s, save=True) if refresh or not s.evaluation else s.evaluation for s in strategies]
    baseline = next((e for e, s in zip(evals, strategies) if s.is_baseline), evals[0] if evals else None)
    metrics = []
    for path, label, hib in COMPARE_METRICS:
        values = [_dig(e, path) for e in evals]
        numeric = [(i, v) for i, v in enumerate(values) if isinstance(v, (int, float))]
        best_index = None
        if numeric:
            best_index = (max if hib else min)(numeric, key=lambda x: x[1])[0]
        base_val = _dig(baseline, path) if baseline else None
        metrics.append(
            {
                "key": ".".join(path),
                "label": label,
                "higher_is_better": hib,
                "values": values,
                "deltas": [
                    (round(v - base_val, 2) if isinstance(v, (int, float)) and isinstance(base_val, (int, float)) else None)
                    for v in values
                ],
                "best_index": best_index,
            }
        )
    # Overall ranking: margin per acre, penalised by risk and infeasibility.
    ranking = []
    for i, e in enumerate(evals):
        margin_pa = _dig(e, ("totals", "margin_per_acre")) or 0.0
        score = margin_pa - (e.get("risk_score") or 0) * 2 - (e.get("hard_violations") or 0) * 500
        ranking.append({"index": i, "strategy_id": e["strategy_id"], "name": e["name"], "score": round(score, 1)})
    ranking.sort(key=lambda r: -r["score"])
    return {
        "strategies": evals,
        "baseline_id": baseline["strategy_id"] if baseline else None,
        "metrics": metrics,
        "ranking": ranking,
        "crop_mix": [
            {"name": e["name"], "crop_acres": e["totals"]["crop_acres"]} for e in evals
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Strategy lifecycle
# ─────────────────────────────────────────────────────────────────────────────


@transaction.atomic
def adopt_strategy(strategy: FarmingStrategy, user=None) -> dict:
    """Materialise a strategy into CropPlans for its season.

    Existing *planned* plans for the same field/season are replaced; plans that
    are already planted or further along are left alone and reported.
    """
    crops = {str(c.id): c for c in Crop.objects.filter(organization_id=strategy.organization_id)}
    varieties = {str(v.id): v for v in CropVariety.objects.filter(crop__organization_id=strategy.organization_id)}
    created, updated, skipped = [], [], []
    for a in strategy.allocations.select_related("field", "crop", "variety"):
        if not a.crop:
            continue
        existing = CropPlan.objects.filter(field=a.field, season=strategy.season).exclude(
            status=CropPlan.Status.CANCELLED
        )
        locked = existing.exclude(status=CropPlan.Status.PLANNED).first()
        if locked:
            skipped.append({"field": a.field.name, "reason": f"{locked.crop.name} already {locked.status}"})
            continue
        dtm = days_to_maturity(a.crop, a.variety)
        defaults = {
            "crop": a.crop,
            "variety": a.variety,
            "planting_system": a.planting_system,
            "acres": a.acres,
            "planting_date": a.planting_date,
            "expected_harvest_date": (a.planting_date + timedelta(days=dtm)) if a.planting_date else None,
            "target_yield": (a.variety.effective_yield if a.variety else a.crop.expected_yield_per_acre) or None,
            "yield_unit": (a.variety.yield_unit if a.variety else a.crop.yield_unit),
            "status": CropPlan.Status.PLANNED,
            "strategy": strategy,
            "rotation": strategy.rotation,
            "notes": a.notes or f"Adopted from strategy “{strategy.name}”.",
        }
        plan = existing.filter(status=CropPlan.Status.PLANNED).first()
        if plan:
            for k, v in defaults.items():
                setattr(plan, k, v)
            plan.save()
            plan.components.all().delete()
            updated.append(str(plan.id))
        else:
            plan = CropPlan.objects.create(field=a.field, season=strategy.season, **defaults)
            created.append(str(plan.id))
        for i, c in enumerate(a.components or []):
            crop = crops.get(str(c.get("crop")))
            if not crop:
                continue
            CropPlanComponent.objects.create(
                crop_plan=plan,
                crop=crop,
                variety=varieties.get(str(c.get("variety"))) if c.get("variety") else None,
                role=c.get("role") or CropPlanComponent.Role.INTERCROP,
                share_pct=_d(c.get("share_pct"), Decimal("50")),
                row_arrangement=c.get("row_arrangement", ""),
                order=i + 1,
            )
    FarmingStrategy.objects.filter(farm=strategy.farm, season=strategy.season, status=FarmingStrategy.Status.ADOPTED).exclude(
        pk=strategy.pk
    ).update(status=FarmingStrategy.Status.CANDIDATE)
    strategy.status = FarmingStrategy.Status.ADOPTED
    strategy.adopted_at = timezone.now()
    strategy.save(update_fields=["status", "adopted_at", "updated_at"])
    return {"created": created, "updated": updated, "skipped": skipped}


@transaction.atomic
def clone_strategy(strategy: FarmingStrategy, name: str | None = None, user=None) -> FarmingStrategy:
    clone = FarmingStrategy.objects.create(
        organization=strategy.organization,
        farm=strategy.farm,
        season=strategy.season,
        name=name or f"{strategy.name} (copy)",
        description=strategy.description,
        status=FarmingStrategy.Status.DRAFT,
        is_baseline=False,
        rotation=strategy.rotation,
        price_multiplier=strategy.price_multiplier,
        yield_multiplier=strategy.yield_multiplier,
        cost_multiplier=strategy.cost_multiplier,
        rainfall_scenario=strategy.rainfall_scenario,
        created_by=user,
    )
    StrategyAllocation.objects.bulk_create(
        [
            StrategyAllocation(
                strategy=clone,
                field=a.field,
                crop=a.crop,
                variety=a.variety,
                planting_system=a.planting_system,
                acres=a.acres,
                planting_date=a.planting_date,
                components=a.components,
                notes=a.notes,
            )
            for a in strategy.allocations.all()
        ]
    )
    return clone


def rotation_preview(rotation: RotationPlan, season: GrowingSeason) -> list[dict]:
    """What each assigned field would grow in `season` under this rotation."""
    year = season.year
    out = []
    for f in rotation.fields.select_related("farm").order_by("name"):
        step = rotation.step_for_year(year, field=f)
        companions = list(step.companion_crops.all()) if step else []
        window = resolve_window(step.crop, step.variety, f.farm, year) if step and step.crop else None
        out.append(
            {
                "field_id": str(f.id),
                "field_name": f.name,
                "acres": _q(_d(f.acres)),
                "step_id": str(step.id) if step else None,
                "year_offset": step.year_offset if step else None,
                "role": step.role if step else None,
                "crop_id": str(step.crop_id) if step and step.crop_id else None,
                "crop_name": step.crop.name if step and step.crop else ("Fallow" if step else None),
                "variety_id": str(step.variety_id) if step and step.variety_id else None,
                "variety_name": step.variety.name if step and step.variety else None,
                "companions": [{"id": str(c.id), "name": c.name} for c in companions],
                "suggested_planting": window["start"].isoformat() if window and window["start"] else None,
            }
        )
    return out


@transaction.atomic
def strategy_from_rotation(rotation: RotationPlan, season: GrowingSeason, name: str | None = None, user=None) -> FarmingStrategy:
    strategy = FarmingStrategy.objects.create(
        organization_id=rotation.farm.organization_id,
        farm=rotation.farm,
        season=season,
        name=name or f"{rotation.name} · {season.name}",
        description=f"Generated from rotation “{rotation.name}”.",
        rotation=rotation,
        created_by=user,
    )
    for row in rotation_preview(rotation, season):
        if not row["crop_id"]:
            continue
        companions = row["companions"]
        share = Decimal("100") / (len(companions) + 1) if companions else ZERO
        StrategyAllocation.objects.create(
            strategy=strategy,
            field_id=row["field_id"],
            crop_id=row["crop_id"],
            variety_id=row["variety_id"],
            planting_system=PlantingSystem.INTERCROP if companions else PlantingSystem.MONOCULTURE,
            planting_date=date.fromisoformat(row["suggested_planting"]) if row["suggested_planting"] else None,
            components=[
                {"crop": c["id"], "variety": None, "share_pct": _q(share), "role": "intercrop"} for c in companions
            ],
        )
    evaluate_strategy(strategy)
    return strategy
