class OrganizationQuerySetMixin:
    """Filter querysets to the organization on the request.

    Resolution order:
    organization FK, farm FK, field FK, sensor FK, zone FK, equipment FK, item FK,
    then additional nested relations used across AgriNexa models.
    """

    org_lookup_chain = (
        ("organization", "organization"),
        ("farm", "farm__organization"),
        ("field", "field__farm__organization"),
        ("sensor", "sensor__farm__organization"),
        ("zone", "zone__farm__organization"),
        ("equipment", "equipment__farm__organization"),
        ("item", "item__organization"),
        ("crop", "crop__organization"),
        ("crop_plan", "crop_plan__field__farm__organization"),
        ("team", "team__organization"),
        ("report", "report__field__farm__organization"),
        ("station", "station__farm__organization"),
        ("season", "season__organization"),
        ("role", "role__organization"),
    )

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request, "organization", None)
        if org is None:
            return qs.none()
        qs = self.filter_by_organization(qs, org)
        return self.filter_by_farm_access(qs, self.request.user, org)

    def filter_by_organization(self, qs, org):
        model = qs.model
        field_names = {f.name for f in model._meta.fields}
        if model.__name__ == "Farm":
            return qs.filter(organization=org)
        for fname, lookup in self.org_lookup_chain:
            if fname in field_names:
                return qs.filter(**{lookup: org})
        return qs.none()

    def filter_by_farm_access(self, qs, user, org):
        from apps.common.scoping import accessible_farm_ids

        farm_ids = accessible_farm_ids(user, org)
        if farm_ids is None:
            return qs
        if not farm_ids:
            return qs.none()

        model = qs.model
        field_names = {f.name for f in model._meta.fields}
        if model.__name__ == "Farm":
            return qs.filter(id__in=farm_ids)
        if "farm" in field_names:
            # Org-wide records (farm is NULL) stay visible to restricted users.
            return qs.filter(farm_id__in=farm_ids) | qs.filter(farm__isnull=True)
        if "field" in field_names:
            return qs.filter(field__farm_id__in=farm_ids)
        if "sensor" in field_names:
            return qs.filter(sensor__farm_id__in=farm_ids)
        if "zone" in field_names:
            return qs.filter(zone__farm_id__in=farm_ids)
        if "equipment" in field_names:
            return qs.filter(equipment__farm_id__in=farm_ids)
        if "crop_plan" in field_names:
            return qs.filter(crop_plan__field__farm_id__in=farm_ids)
        if "report" in field_names:
            return qs.filter(report__field__farm_id__in=farm_ids)
        if "station" in field_names:
            return qs.filter(station__farm_id__in=farm_ids)
        if "item" in field_names:
            return qs.filter(item__farm_id__in=farm_ids) | qs.filter(
                item__farm__isnull=True, item__organization=org
            )
        return qs

    def perform_create(self, serializer):
        extra = self.get_create_defaults(serializer)
        serializer.save(**extra)

    def get_create_defaults(self, serializer):
        model = serializer.Meta.model
        names = {f.name for f in model._meta.fields}
        extra = {}
        org = getattr(self.request, "organization", None)
        user = getattr(self.request, "user", None)
        if "organization" in names and not serializer.validated_data.get("organization") and org:
            extra["organization"] = org
        for field, value in (
            ("author", user),
            ("created_by", user),
            ("scout", user),
            ("uploaded_by", user),
            ("invited_by", user),
            ("reported_by", user),
            ("triggered_by", user),
        ):
            if field in names and not serializer.validated_data.get(field) and value and value.is_authenticated:
                extra[field] = value
        return extra
