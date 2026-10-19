from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.weather.views import (
    WeatherAlertViewSet,
    WeatherCurrentView,
    WeatherForecastView,
    WeatherHistoryView,
    WeatherRecommendationsView,
    WeatherStationViewSet,
)

router = DefaultRouter()
router.register("weather-stations", WeatherStationViewSet, basename="weather-station")
router.register("weather/alerts", WeatherAlertViewSet, basename="weather-alert")

urlpatterns = [
    path("weather/current/", WeatherCurrentView.as_view(), name="weather-current"),
    path("weather/forecast/", WeatherForecastView.as_view(), name="weather-forecast"),
    path("weather/history/", WeatherHistoryView.as_view(), name="weather-history"),
    path("weather/recommendations/", WeatherRecommendationsView.as_view(), name="weather-recommendations"),
    path("", include(router.urls)),
]
