from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _user_can_access_farm(user, farm_id):
    from apps.farms.models import Farm
    from apps.tenancy.models import Membership

    farm = Farm.objects.filter(pk=farm_id).first()
    if farm is None:
        return False
    return Membership.objects.filter(
        user=user, organization=farm.organization, is_active=True
    ).exists()


class SensorStreamConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or isinstance(user, AnonymousUser) or not user.is_authenticated:
            await self.close()
            return
        self.farm_id = self.scope["url_route"]["kwargs"]["farm_id"]
        if not await _user_can_access_farm(user, self.farm_id):
            await self.close()
            return
        self.group_name = f"farm_{self.farm_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def sensor_reading(self, event):
        await self.send_json(event["payload"])
