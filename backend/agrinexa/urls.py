from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.tenancy.urls")),
    path("api/", include("apps.farms.urls")),
    path("api/", include("apps.crops.urls")),
    path("api/", include("apps.sensors.urls")),
    path("api/", include("apps.irrigation.urls")),
    path("api/", include("apps.scouting.urls")),
    path("api/", include("apps.weather.urls")),
    path("api/", include("apps.inventory.urls")),
    path("api/", include("apps.equipment.urls")),
    path("api/", include("apps.platform.urls")),
    path("api/", include("apps.analytics.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "AgriNexa Administration"
admin.site.site_title = "AgriNexa"
admin.site.index_title = "Precision farming control plane"
