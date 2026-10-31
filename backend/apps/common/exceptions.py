from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def agrinexa_exception_handler(exc, context):
    if isinstance(exc, ProtectedError):
        return Response(
            {
                "detail": "This record is referenced by other records and cannot be deleted.",
                "code": "protected",
            },
            status=status.HTTP_409_CONFLICT,
        )
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    payload = {"detail": "An error occurred", "code": getattr(exc, "default_code", "error")}

    if isinstance(data, dict):
        detail = data.get("detail")
        extra_keys = set(data.keys()) - {"detail", "code"}
        if extra_keys:
            payload["detail"] = str(detail) if detail else "Validation failed"
            payload["code"] = str(data.get("code", getattr(exc, "default_code", "invalid")))
            payload["errors"] = {k: data[k] for k in data if k not in {"detail", "code"}} if detail else data
        elif detail is not None:
            payload["detail"] = str(detail)
            payload["code"] = str(data.get("code", getattr(exc, "default_code", "error")))
        else:
            payload["detail"] = "Validation failed"
            payload["code"] = getattr(exc, "default_code", "invalid")
            payload["errors"] = data
    elif isinstance(data, list):
        payload["detail"] = str(data[0]) if data else "An error occurred"
        payload["code"] = getattr(exc, "default_code", "error")
        if len(data) > 1:
            payload["errors"] = data
    else:
        payload["detail"] = str(data)

    response.data = payload
    return response
