from rest_framework import serializers

from apps.farms.models import CropHistory, Farm, Field, FieldNote, Plot, Region


class RegionSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, default=None)

    class Meta:
        model = Region
        fields = (
            "id",
            "organization",
            "name",
            "parent",
            "parent_name",
            "code",
            "geojson",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")

    def validate(self, attrs):
        name = attrs.get("name", getattr(self.instance, "name", None))
        request = self.context.get("request")
        org = getattr(request, "organization", None) if request else None
        if name and org:
            qs = Region.objects.filter(organization=org, name=name)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "A region with this name already exists."})
        return attrs


class FarmSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source="region.name", read_only=True, default=None)
    field_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Farm
        fields = (
            "id",
            "organization",
            "region",
            "region_name",
            "name",
            "code",
            "address",
            "lat",
            "lng",
            "total_acres",
            "timezone",
            "soil_summary",
            "contact_name",
            "contact_phone",
            "status",
            "notes",
            "settings",
            "field_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")


class FieldSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source="farm.name", read_only=True)
    current_crop_name = serializers.CharField(
        source="current_crop_plan.crop.name", read_only=True, default=None, allow_null=True
    )
    crop_name = serializers.CharField(
        source="current_crop_plan.crop.name", read_only=True, default=None, allow_null=True
    )
    harvest_date = serializers.DateField(source="expected_harvest_date", required=False, allow_null=True)
    health_status = serializers.SerializerMethodField()
    moisture = serializers.SerializerMethodField()

    class Meta:
        model = Field
        fields = (
            "id",
            "farm",
            "farm_name",
            "name",
            "code",
            "acres",
            "boundary",
            "soil_type",
            "soil_ph",
            "organic_matter",
            "irrigation_type",
            "drainage",
            "status",
            "centroid_lat",
            "centroid_lng",
            "planting_date",
            "expected_harvest_date",
            "harvest_date",
            "current_crop_plan",
            "current_crop_name",
            "crop_name",
            "health_status",
            "moisture",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_health_status(self, obj):
        mapping = {
            "excellent": "healthy",
            "good": "healthy",
            "fair": "warning",
            "poor": "critical",
            "critical": "critical",
        }
        latest = getattr(obj, "prefetched_scout", None)
        if latest is None:
            reports = getattr(obj, "scout_reports", None)
            if reports is not None:
                latest = next(iter(reports.all()), None)
        if latest:
            return mapping.get(latest.overall_health, "idle")
        if obj.status == "planted":
            return "healthy"
        if obj.status == "prep":
            return "warning"
        return "idle"

    def get_moisture(self, obj):
        for sensor in getattr(obj, "sensors", []).all() if hasattr(obj, "sensors") else []:
            if getattr(sensor.sensor_type, "category", None) != "soil_moisture":
                continue
            reading = sensor.readings.order_by("-recorded_at").first() if hasattr(sensor, "readings") else None
            if reading:
                return float(reading.value)
        return None


class FieldNoteSerializer(serializers.ModelSerializer):
    author_email = serializers.CharField(source="author.email", read_only=True, default=None)
    author_name = serializers.CharField(source="author.full_name", read_only=True, default=None)
    field_name = serializers.CharField(source="field.name", read_only=True)
    body = serializers.CharField(source="content", required=False)

    class Meta:
        model = FieldNote
        fields = (
            "id",
            "field",
            "field_name",
            "author",
            "author_email",
            "author_name",
            "note_type",
            "content",
            "body",
            "gps_lat",
            "gps_lng",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "author", "created_at", "updated_at")
        extra_kwargs = {"content": {"required": False}}

    def validate(self, attrs):
        # `body` is an alias for `content`; both map to the content attribute.
        if self.instance is None and not attrs.get("content"):
            raise serializers.ValidationError({"content": "Either 'content' or 'body' is required."})
        return attrs


class CropHistorySerializer(serializers.ModelSerializer):
    season = serializers.CharField(source="season_name", required=False, allow_blank=True)

    class Meta:
        model = CropHistory
        fields = (
            "id",
            "field",
            "crop_name",
            "variety_name",
            "season_name",
            "season",
            "planted_at",
            "harvested_at",
            "yield_amount",
            "yield_unit",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "field", "created_at", "updated_at")


class PlotSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source="field.name", read_only=True)

    class Meta:
        model = Plot
        fields = (
            "id",
            "field",
            "field_name",
            "name",
            "acres",
            "boundary",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
