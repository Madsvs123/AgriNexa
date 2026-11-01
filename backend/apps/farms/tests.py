from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from apps.farms import geometry


def square(lng0, lat0, size):
    """Closed square ring starting at (lng0, lat0), `size` degrees wide."""
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [lng0, lat0],
                [lng0 + size, lat0],
                [lng0 + size, lat0 + size],
                [lng0, lat0 + size],
                [lng0, lat0],
            ]
        ],
    }


class GeometryTests(SimpleTestCase):
    def test_valid_polygon_passes(self):
        geometry.validate_polygon(square(-93.6, 41.6, 0.01))

    def test_open_ring_rejected(self):
        poly = square(-93.6, 41.6, 0.01)
        poly["coordinates"][0] = poly["coordinates"][0][:-1]
        with self.assertRaises(geometry.GeometryError):
            geometry.validate_polygon(poly)

    def test_out_of_range_coordinates_rejected(self):
        poly = square(179.995, 41.6, 0.01)  # crosses lng 180
        with self.assertRaises(geometry.GeometryError):
            geometry.validate_polygon(poly)

    def test_self_intersection_rejected(self):
        bowtie = {
            "type": "Polygon",
            "coordinates": [
                [[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]],
            ],
        }
        with self.assertRaises(geometry.GeometryError):
            geometry.validate_polygon(bowtie)

    def test_zero_area_rejected(self):
        line = {
            "type": "Polygon",
            "coordinates": [[[0, 0], [1, 0], [2, 0], [0, 0]]],
        }
        with self.assertRaises(geometry.GeometryError):
            geometry.validate_polygon(line)

    def test_non_polygon_rejected(self):
        with self.assertRaises(geometry.GeometryError):
            geometry.validate_polygon({"type": "Point", "coordinates": [0, 0]})

    def test_area_estimate_close_to_truth(self):
        # 0.01° x 0.01° square at 41.6°N ≈ 1.112 km * 0.8317 km ≈ 228.6 acres
        acres = geometry.polygon_area_acres(square(-93.6, 41.6, 0.01))
        self.assertAlmostEqual(acres, 228.6, delta=3.0)

    def test_centroid(self):
        lat, lng = geometry.polygon_centroid(square(-93.6, 41.6, 0.01))
        self.assertAlmostEqual(lat, 41.605, places=3)
        self.assertAlmostEqual(lng, -93.595, places=3)

    def test_containment(self):
        field = square(-93.6, 41.6, 0.01)
        inside = square(-93.598, 41.602, 0.002)
        outside = square(-93.7, 41.7, 0.002)
        straddling = square(-93.601, 41.602, 0.004)
        self.assertTrue(geometry.polygon_contains(field, inside))
        self.assertFalse(geometry.polygon_contains(field, outside))
        self.assertFalse(geometry.polygon_contains(field, straddling))

    def test_overlap(self):
        a = square(-93.6, 41.6, 0.004)
        b = square(-93.598, 41.602, 0.004)  # overlaps a
        c = square(-93.590, 41.610, 0.004)  # disjoint
        self.assertTrue(geometry.polygons_overlap(a, b))
        self.assertFalse(geometry.polygons_overlap(a, c))
        self.assertTrue(geometry.polygons_overlap(a, square(-93.599, 41.601, 0.001)))  # contained


class SpatialApiTests(APITestCase):
    def setUp(self):
        self.client.post(
            "/api/auth/register/",
            {
                "email": "geo@agrinexa.test",
                "password": "Harvest!2026-strong",
                "first_name": "Geo",
                "last_name": "Tester",
                "organization_name": "Geo Farms",
            },
            format="json",
        )
        body = self.client.post(
            "/api/auth/login/",
            {"email": "geo@agrinexa.test", "password": "Harvest!2026-strong"},
            format="json",
        ).json()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {body['access']}",
            HTTP_X_ORGANIZATION_ID=body["organizations"][0]["id"],
        )
        self.farm_id = self.client.post(
            "/api/farms/", {"name": "Geo Farm", "code": "GF-01"}, format="json"
        ).json()["id"]

    def _create_field(self, boundary):
        return self.client.post(
            "/api/fields/",
            {"farm": self.farm_id, "name": "North 80", "boundary": boundary},
            format="json",
        )

    def test_field_boundary_computes_acres_and_centroid(self):
        res = self._create_field(square(-93.6, 41.6, 0.01))
        self.assertEqual(res.status_code, 201, res.content)
        data = res.json()
        self.assertAlmostEqual(float(data["acres"]), 228.6, delta=3.0)
        self.assertAlmostEqual(float(data["centroid_lat"]), 41.605, places=3)
        self.assertAlmostEqual(float(data["centroid_lng"]), -93.595, places=3)

    def test_invalid_field_boundary_rejected(self):
        res = self._create_field(
            {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]]}
        )
        self.assertEqual(res.status_code, 400, res.content)

    def test_plot_must_be_inside_field(self):
        field_id = self._create_field(square(-93.6, 41.6, 0.01)).json()["id"]
        outside = self.client.post(
            "/api/plots/",
            {"field": field_id, "name": "Rogue", "boundary": square(-93.7, 41.7, 0.002)},
            format="json",
        )
        self.assertEqual(outside.status_code, 400, outside.content)
        inside = self.client.post(
            "/api/plots/",
            {"field": field_id, "name": "P1", "boundary": square(-93.598, 41.602, 0.002)},
            format="json",
        )
        self.assertEqual(inside.status_code, 201, inside.content)
        self.assertGreater(float(inside.json()["acres"]), 0)

    def test_plots_may_not_overlap(self):
        field_id = self._create_field(square(-93.6, 41.6, 0.01)).json()["id"]
        first = self.client.post(
            "/api/plots/",
            {"field": field_id, "name": "P1", "boundary": square(-93.598, 41.602, 0.003)},
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.content)
        overlapping = self.client.post(
            "/api/plots/",
            {"field": field_id, "name": "P2", "boundary": square(-93.597, 41.603, 0.003)},
            format="json",
        )
        self.assertEqual(overlapping.status_code, 400, overlapping.content)
        disjoint = self.client.post(
            "/api/plots/",
            {"field": field_id, "name": "P3", "boundary": square(-93.594, 41.606, 0.002)},
            format="json",
        )
        self.assertEqual(disjoint.status_code, 201, disjoint.content)
