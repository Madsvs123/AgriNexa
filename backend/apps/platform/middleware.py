from apps.platform.models import log_audit


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class AuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._audit(request, response)
        except Exception:
            pass
        return response

    def _audit(self, request, response):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return
        path = request.path or ""
        if not path.startswith("/api/"):
            return
        if path.startswith("/api/auth/"):
            return
        if "notifications" in path and "read" in path:
            return
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return
        log_audit(
            organization=getattr(request, "organization", None),
            user=user,
            action=request.method,
            model_name=path,
            object_id="",
            changes={"status": getattr(response, "status_code", None)},
            ip_address=_client_ip(request),
        )
