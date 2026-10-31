import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { wsUrl } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

export function useSensorSocket(farmId: string | null | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  useEffect(() => {
    if (!token || !farmId) return;
    const ws = new WebSocket(wsUrl(`/ws/sensors/${farmId}/`, token));
    ws.onmessage = () => {
      qc.invalidateQueries({ queryKey: ["sensors"] });
      qc.invalidateQueries({ queryKey: ["sensor-live"] });
    };
    return () => ws.close();
  }, [token, farmId, qc]);
}
