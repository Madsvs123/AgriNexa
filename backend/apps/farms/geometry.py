"""Planar/geodesic helpers for GeoJSON polygons stored as plain JSON.

All functions work on GeoJSON Polygon dicts: {"type": "Polygon",
"coordinates": [[[lng, lat], ...], ...]} with the first ring as the outer
boundary and any further rings as holes. Coordinates are WGS84 degrees.

The project deliberately avoids a GIS stack (PostGIS/shapely): field and
plot boundaries are small (hundreds of vertices), so exact pure-Python
checks and an equirectangular area approximation are accurate enough for
farm acreage (sub-percent error at field scale).
"""

import math

EARTH_RADIUS_M = 6371008.8
SQ_M_PER_ACRE = 4046.8564224
MAX_VERTICES = 2000


class GeometryError(ValueError):
    pass


def _rings(polygon):
    if not isinstance(polygon, dict):
        raise GeometryError("Boundary must be a GeoJSON object.")
    if polygon.get("type") != "Polygon":
        raise GeometryError("Boundary must be a GeoJSON Polygon.")
    rings = polygon.get("coordinates")
    if not isinstance(rings, (list, tuple)) or not rings:
        raise GeometryError("Polygon must have at least one coordinate ring.")
    return rings


def _validate_ring(ring, label="ring"):
    if not isinstance(ring, (list, tuple)) or len(ring) < 4:
        raise GeometryError(f"Each {label} needs at least 4 positions (closed ring).")
    if len(ring) > MAX_VERTICES:
        raise GeometryError(f"Too many vertices (max {MAX_VERTICES}).")
    for pt in ring:
        if (
            not isinstance(pt, (list, tuple))
            or len(pt) < 2
            or not all(isinstance(c, (int, float)) and not isinstance(c, bool) for c in pt[:2])
        ):
            raise GeometryError("Positions must be [longitude, latitude] numbers.")
        lng, lat = pt[0], pt[1]
        if not (-180.0 <= lng <= 180.0):
            raise GeometryError(f"Longitude {lng} out of range [-180, 180].")
        if not (-90.0 <= lat <= 90.0):
            raise GeometryError(f"Latitude {lat} out of range [-90, 90].")
    if ring[0][0] != ring[-1][0] or ring[0][1] != ring[-1][1]:
        raise GeometryError("Ring must be closed (first and last position equal).")
    for a, b in zip(ring, ring[1:]):
        if a[0] == b[0] and a[1] == b[1]:
            raise GeometryError("Ring contains repeated consecutive positions.")


def _orient(p, q, r):
    val = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    if abs(val) < 1e-15:
        return 0
    return 1 if val > 0 else 2


def _on_segment(p, q, r):
    return (
        min(p[0], r[0]) - 1e-15 <= q[0] <= max(p[0], r[0]) + 1e-15
        and min(p[1], r[1]) - 1e-15 <= q[1] <= max(p[1], r[1]) + 1e-15
    )


def segments_intersect(p1, p2, p3, p4):
    """True if segment p1-p2 intersects p3-p4 (touching endpoints included)."""
    o1, o2 = _orient(p1, p2, p3), _orient(p1, p2, p4)
    o3, o4 = _orient(p3, p4, p1), _orient(p3, p4, p2)
    if o1 != o2 and o3 != o4:
        return True
    if o1 == 0 and _on_segment(p1, p3, p2):
        return True
    if o2 == 0 and _on_segment(p1, p4, p2):
        return True
    if o3 == 0 and _on_segment(p3, p1, p4):
        return True
    if o4 == 0 and _on_segment(p3, p2, p4):
        return True
    return False


def _ring_self_intersects(ring):
    # Closed ring: compare non-adjacent segment pairs only.
    segs = list(zip(ring[:-1], ring[1:]))
    n = len(segs)
    for i in range(n):
        for j in range(i + 1, n):
            if j == i + 1 or (i == 0 and j == n - 1):
                continue  # adjacent segments share a vertex by construction
            if segments_intersect(segs[i][0], segs[i][1], segs[j][0], segs[j][1]):
                return True
    return False


def validate_polygon(polygon):
    """Raise GeometryError unless `polygon` is a well-formed, simple Polygon."""
    rings = _rings(polygon)
    for idx, ring in enumerate(rings):
        label = "outer ring" if idx == 0 else f"hole {idx}"
        _validate_ring(ring, label)
        if _ring_self_intersects(ring):
            raise GeometryError(f"The {label} intersects itself.")
    if abs(_planar_ring_area(rings[0])) < 1e-14:
        raise GeometryError("Polygon encloses no area.")
    return polygon


def _planar_ring_area(ring):
    """Shoelace area in degrees² (signed)."""
    total = 0.0
    for (x1, y1, *_), (x2, y2, *_) in zip(ring[:-1], ring[1:]):
        total += x1 * y2 - x2 * y1
    return total / 2.0


def ring_area_sq_m(ring):
    """Approximate geodesic ring area via equirectangular projection."""
    mean_lat = sum(pt[1] for pt in ring[:-1]) / (len(ring) - 1)
    k = math.radians(1) * EARTH_RADIUS_M
    scale_x = k * math.cos(math.radians(mean_lat))
    total = 0.0
    for (x1, y1, *_), (x2, y2, *_) in zip(ring[:-1], ring[1:]):
        total += (x1 * scale_x) * (y2 * k) - (x2 * scale_x) * (y1 * k)
    return abs(total) / 2.0


def polygon_area_acres(polygon):
    rings = _rings(polygon)
    area = ring_area_sq_m(rings[0])
    for hole in rings[1:]:
        area -= ring_area_sq_m(hole)
    return max(area, 0.0) / SQ_M_PER_ACRE


def polygon_centroid(polygon):
    """(lat, lng) centroid of the outer ring (planar formula)."""
    ring = _rings(polygon)[0]
    a = _planar_ring_area(ring)
    if abs(a) < 1e-14:
        lats = [p[1] for p in ring[:-1]]
        lngs = [p[0] for p in ring[:-1]]
        return sum(lats) / len(lats), sum(lngs) / len(lngs)
    cx = cy = 0.0
    for (x1, y1, *_), (x2, y2, *_) in zip(ring[:-1], ring[1:]):
        cross = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    return cy / (6.0 * a), cx / (6.0 * a)


def point_in_ring(lng, lat, ring):
    """Ray casting; boundary points count as inside."""
    for (x1, y1, *_), (x2, y2, *_) in zip(ring[:-1], ring[1:]):
        if _orient((x1, y1), (x2, y2), (lng, lat)) == 0 and _on_segment((x1, y1), (lng, lat), (x2, y2)):
            return True
    inside = False
    for (x1, y1, *_), (x2, y2, *_) in zip(ring[:-1], ring[1:]):
        if (y1 > lat) != (y2 > lat):
            x_cross = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
            if lng < x_cross:
                inside = not inside
    return inside


def polygon_contains(outer, inner):
    """True if the inner Polygon lies within the outer Polygon's outer ring."""
    outer_ring = _rings(outer)[0]
    inner_ring = _rings(inner)[0]
    for pt in inner_ring[:-1]:
        if not point_in_ring(pt[0], pt[1], outer_ring):
            return False
    # Vertices inside is not enough: edges may still cross the outer ring.
    outer_segs = list(zip(outer_ring[:-1], outer_ring[1:]))
    for s1, s2 in zip(inner_ring[:-1], inner_ring[1:]):
        for o1, o2 in outer_segs:
            if _orient(o1, o2, s1) == 0 or _orient(o1, o2, s2) == 0:
                continue  # touching the boundary is allowed
            if segments_intersect(s1, s2, o1, o2):
                return False
    return True


def polygons_overlap(a, b):
    """True if two Polygons' outer rings overlap (shared boundary is fine)."""
    ring_a = _rings(a)[0]
    ring_b = _rings(b)[0]
    segs_a = list(zip(ring_a[:-1], ring_a[1:]))
    for s1, s2 in zip(ring_b[:-1], ring_b[1:]):
        for o1, o2 in segs_a:
            if _orient(o1, o2, s1) == 0 or _orient(o1, o2, s2) == 0:
                continue
            if _orient(s1, s2, o1) == 0 or _orient(s1, s2, o2) == 0:
                continue
            if segments_intersect(s1, s2, o1, o2):
                return True
    # No proper edge crossings: one may still fully contain the other.
    def strictly_inside(pt, ring):
        for (x1, y1, *_), (x2, y2, *_) in zip(ring[:-1], ring[1:]):
            if _orient((x1, y1), (x2, y2), (pt[0], pt[1])) == 0 and _on_segment(
                (x1, y1), (pt[0], pt[1]), (x2, y2)
            ):
                return False
        return point_in_ring(pt[0], pt[1], ring)

    if any(strictly_inside(pt, ring_a) for pt in ring_b[:-1]):
        return True
    if any(strictly_inside(pt, ring_b) for pt in ring_a[:-1]):
        return True
    return False


def has_boundary(polygon):
    return bool(polygon) and isinstance(polygon, dict) and polygon.get("coordinates")
