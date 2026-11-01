import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  Flex,
} from "@chakra-ui/react";
import { NavRail } from "./NavRail";
import { SectionPanel, SectionPanelContent } from "./SectionPanel";
import { ContextBar } from "./ContextBar";
import { CommandPalette } from "./CommandPalette";
import { MobileTabBar } from "./MobileTabBar";
import { PageTitleProvider } from "./PageTitleContext";
import { matchRoute } from "@/navigation/manifest";
import { useAuthStore } from "@/stores/authStore";
import { useScopeStore } from "@/stores/scopeStore";
import { useUiStore } from "@/stores/uiStore";
import { wsUrl } from "@/lib/utils";
import { layout } from "@/theme";

function MobileNav() {
  const open = useUiStore((s) => s.navDrawerOpen);
  const setOpen = useUiStore((s) => s.setNavDrawerOpen);
  const close = () => setOpen(false);

  return (
    <Drawer isOpen={open} onClose={close} placement="left">
      <DrawerOverlay />
      <DrawerContent maxW={`calc(${layout.railWidth} + ${layout.sectionPanelWidth})`}>
        <DrawerBody p={0}>
          <Flex h="100%">
            <NavRail onNavigate={close} />
            <Box flex="1" minW={0}>
              <SectionPanelContent onNavigate={close} />
            </Box>
          </Flex>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

export function AppShell() {
  const location = useLocation();
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const orgId = useAuthStore((s) => s.currentOrgId);
  const setNavDrawerOpen = useUiStore((s) => s.setNavDrawerOpen);
  const sectionPanelOpen = useUiStore((s) => s.sectionPanelOpen);
  const scopeFarmId = useScopeStore((s) => s.farmId);
  const resetScope = useScopeStore((s) => s.reset);
  const fullBleed = matchRoute(location.pathname)?.fullBleed ?? false;

  // Close only the mobile drawer on navigation. The desktop section panel is a
  // persistent surface and must not collapse every time the route changes.
  useEffect(() => {
    setNavDrawerOpen(false);
  }, [location.pathname, setNavDrawerOpen]);

  // Switching organizations invalidates every cache entry, but skip the very
  // first render — there is nothing cached yet and it causes a double fetch.
  const previousOrg = useRef(orgId);
  useEffect(() => {
    if (previousOrg.current === orgId) return;
    previousOrg.current = orgId;
    // The previous org's farm/season ids do not exist in the new tenant.
    resetScope();
    qc.invalidateQueries();
  }, [orgId, qc, resetScope]);

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(wsUrl("/ws/notifications/", token));
    ws.onmessage = () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    };
    return () => ws.close();
  }, [token, qc]);

  // Live sensor telemetry on the pages that display it. The farm now comes from
  // global scope rather than being re-parsed out of each page's query string.
  const liveSensors =
    location.pathname.startsWith("/sensors") || location.pathname.startsWith("/map");
  useEffect(() => {
    if (!token || !liveSensors || !scopeFarmId) return;
    const ws = new WebSocket(wsUrl(`/ws/sensors/${scopeFarmId}/`, token));
    ws.onmessage = () => {
      qc.invalidateQueries({ queryKey: ["sensors"] });
      qc.invalidateQueries({ queryKey: ["sensor-live"] });
    };
    return () => ws.close();
  }, [token, liveSensors, scopeFarmId, qc]);

  return (
    <PageTitleProvider>
      <Flex h="100vh" overflow="hidden" bg="bg.canvas">
        <Box display={{ base: "none", lg: "block" }} h="100%" zIndex="rail">
          <NavRail />
        </Box>
        {sectionPanelOpen ? (
          <Box zIndex="sectionPanel" h="100%">
            <SectionPanel />
          </Box>
        ) : null}
        <MobileNav />

        <Flex direction="column" flex="1" minW={0} h="100%">
          <ContextBar />
          <Box
            as="main"
            flex="1"
            minH={0}
            overflowY={fullBleed ? "hidden" : "auto"}
            p={fullBleed ? 0 : { base: 4, md: 6 }}
          >
            <Outlet />
          </Box>
          <MobileTabBar />
        </Flex>
      </Flex>
      <CommandPalette />
    </PageTitleProvider>
  );
}
