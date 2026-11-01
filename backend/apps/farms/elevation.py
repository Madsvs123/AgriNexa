"""Elevation estimation for field boundaries.

Samples a grid of points inside the field polygon and resolves their
elevation from the Open-Meteo elevation API (no key required). When the
API is unreachable the module falls back to a deterministic synthetic
terrain model so the feature works offline and in tests; the response's
`source` says which path produced the numbers.
"""

import math

import requests

from apps.farms import geometry

OPEN_METEO_URL = "https://api.open-meteo.com/v1/elevation"
GRID = 5  # sample grid resolution per axis (<= 25 points per request)
TIMEOUT_S = 6


def _sample_points(boundary):
    ring = boundary["coordinates"][0]
    lngs = [p[0] for p in ring[:-1]]
    lats = [p[1] for p in ring[:-1]]
    min_lng, max_lng = min(lngs), max(lngs)
    min_lat, max_lat = min(lats), max(lats)
    points = []
    for i in range(GRID):
        for j in range(GRID):
            lng = min_lng + (max_lng - min_lng) * (i + 0.5) / GRID
            lat = min_lat + (max_lat - min_lat) * (j + 0.5) / GRID
            if geometry.point_in_ring(lng, lat, ring):
                points.append((lat, lng))
    if not points:
        lat, lng = geometry.polygon_centroid(boundary)
        points = [(lat, lng)]
    return points


def _synthetic_elevation(lat, lng):
    """Smooth deterministic pseudo-terrain (offline fallback), in metres."""
    base = 250 + 180 * math.sin(math.radians(lat) * 3.1) * math.cos(math.radians(lng) * 2.7)
    ripple = 12 * math.sin(lat * 430.0) * math.cos(lng * 380.0)
    return round(base + ripple, 1)


def _fetch_open_meteo(points):
    lat_param = ",".join(f"{lat:.6f}" for lat, _ in points)
    lng_param = ",".join(f"{lng:.6f}" for _, lng in points)
    res = requests.get(
        OPEN_METEO_URL,
        params={"latitude": lat_param, "longitude": lng_param},
        timeout=TIMEOUT_S,
    )
    res.raise_for_status()
    elevations = res.json().get("elevation")
    if not isinstance(elevations, list) or len(elevations) != len(points):
        raise ValueError("Unexpected elevation payload")
    return elevations


def estimate_elevation(boundary):
    """Return {source, min_m, max_m, mean_m, points:[{lat,lng,elevation_m}]}."""
    points = _sample_points(boundary)
    try:
        elevations = _fetch_open_meteo(points)
        source = "open-meteo"
    except Exception:
        elevations = [_synthetic_elevation(lat, lng) for lat, lng in points]
        source = "estimate"
    sampled = [
        {"lat": round(lat, 6), "lng": round(lng, 6), "elevation_m": round(float(elev), 1)}
        for (lat, lng), elev in zip(points, elevations)
    ]
    values = [p["elevation_m"] for p in sampled]
    return {
        "source": source,
        "min_m": min(values),
        "max_m": max(values),
        "mean_m": round(sum(values) / len(values), 1),
        "relief_m": round(max(values) - min(values), 1),
        "points": sampled,
    }
