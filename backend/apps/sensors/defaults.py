BUILTIN_SENSOR_TYPES = [
    {
        "name": "Soil Moisture",
        "category": "soil_moisture",
        "unit": "%",
        "min_value": 0,
        "max_value": 100,
        "icon": "droplet",
    },
    {
        "name": "Air Temperature",
        "category": "temperature",
        "unit": "°C",
        "min_value": -40,
        "max_value": 60,
        "icon": "thermometer",
    },
    {
        "name": "Humidity",
        "category": "humidity",
        "unit": "%",
        "min_value": 0,
        "max_value": 100,
        "icon": "droplets",
    },
    {
        "name": "Rainfall",
        "category": "rainfall",
        "unit": "mm",
        "min_value": 0,
        "max_value": 500,
        "icon": "cloud-rain",
    },
    {
        "name": "Soil pH",
        "category": "ph",
        "unit": "pH",
        "min_value": 0,
        "max_value": 14,
        "icon": "flask",
    },
    {
        "name": "Nutrient",
        "category": "nutrient",
        "unit": "ppm",
        "min_value": 0,
        "max_value": 5000,
        "icon": "leaf",
    },
    {
        "name": "Weather Station",
        "category": "weather_station",
        "unit": "mixed",
        "min_value": None,
        "max_value": None,
        "icon": "cloud-sun",
    },
]


def ensure_builtin_sensor_types():
    from apps.sensors.models import SensorType

    created = []
    for spec in BUILTIN_SENSOR_TYPES:
        obj, was_created = SensorType.objects.get_or_create(
            organization=None,
            name=spec["name"],
            defaults={
                "category": spec["category"],
                "unit": spec["unit"],
                "min_value": spec["min_value"],
                "max_value": spec["max_value"],
                "icon": spec["icon"],
            },
        )
        if was_created:
            created.append(obj)
    return created
