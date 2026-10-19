import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { wsUrl } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

export function useSensorSocket(farmId: string | null | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  useEffect(() => {
    if (!token || !farmId) return;
    const ws = new WebSocket(wsUrl(`/ws/devices/${farmId}/`, token));
    ws.onmessage = () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
    };
  }, [token, farmId, qc]);
}
