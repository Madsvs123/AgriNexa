from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs((scope.get("query_string") or b"").decode())
        token = (query.get("token") or [None])[0]
        scope["user"] = await get_user_for_token(token)
        return await super().__call__(scope, receive, send)


@database_sync_to_async
def get_user_for_token(token):
    if not token:
        return AnonymousUser()
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication

        auth = JWTAuthentication()
        validated = auth.get_validated_token(token)
        return auth.get_user(validated)
    except Exception:
        return AnonymousUser()
