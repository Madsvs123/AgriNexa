import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router-dom";
import { Box, Flex } from "@chakra-ui/react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SearchPalette } from "./SearchPalette";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { wsUrl } from "@/lib/utils";

export function AppShell() {
  const location = useLocation();
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const orgId = useAuthStore((s) => s.currentOrgId);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  useEffect(() => {
    qc.invalidateQueries();
  }, [orgId, qc]);

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(wsUrl("/ws/notifications/", token));
    ws.onmessage = () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    };
    return () => ws.close();
  }, [token, qc]);

  const liveSensors = location.pathname.startsWith("/sensors") || location.pathname.startsWith("/map");
  useEffect(() => {
    if (!token || !liveSensors) return;
    const farmMatch = /farm=([0-9a-f-]{36})/i.exec(location.search);
    const farmId = farmMatch?.[1];
    if (!farmId) {
      return;
    }
    const ws = new WebSocket(wsUrl(`/ws/sensors/${farmId}/`, token));
    ws.onmessage = () => {
      qc.invalidateQueries({ queryKey: ["sensors"] });
      qc.invalidateQueries({ queryKey: ["sensor-live"] });
    };
    return () => ws.close();
  }, [token, liveSensors, location.search, qc]);

  return (
    <Flex minH="100vh" bg="bg.canvas">
      <Sidebar />
      <Flex direction="column" flex="1" minW={0}>
        <Topbar />
        <Box as="main" flex="1" p={{ base: 4, md: 6 }}>
          <Outlet />
        </Box>
      </Flex>
      <SearchPalette />
    </Flex>
  );
}
