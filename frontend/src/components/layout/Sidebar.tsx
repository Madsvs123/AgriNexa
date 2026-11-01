import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Collapse,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  Flex,
  Stack,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import {
  Activity,
  BarChart3,
  ChevronDown,
  ClipboardList,
  CloudSun,
  Droplets,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Leaf,
  Map,
  MapPinned,
  Radio,
  Settings,
  Sprout,
  Tractor,
  Warehouse,
} from "lucide-react";
import { useUiStore } from "@/stores/uiStore";

const main = [
  { to: "/home", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/map", label: "Farm map", icon: Map },
  { to: "/farms", label: "Farms", icon: MapPinned },
  { to: "/fields", label: "Fields", icon: Sprout },
];

const cropChildren = [
  { to: "/crops", label: "Catalog", end: true },
  { to: "/crops/plans", label: "Seasonal plans" },
  { to: "/crops/varieties", label: "Varieties" },
  { to: "/crops/seasons", label: "Seasons" },
  { to: "/crops/rotations", label: "Rotations" },
  { to: "/crops/budget", label: "Budget" },
];

const ops = [
  { to: "/sensors", label: "Sensors", icon: Radio },
  { to: "/irrigation", label: "Irrigation", icon: Droplets },
  { to: "/weather", label: "Weather", icon: CloudSun },
  { to: "/scouting", label: "Scouting", icon: ClipboardList },
  { to: "/inventory", label: "Inventory", icon: Warehouse },
  { to: "/equipment", label: "Equipment", icon: Tractor },
];

const insight = [
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/tasks", label: "Tasks", icon: Activity },
  { to: "/documents", label: "Documents", icon: FolderOpen },
];

const settingsChildren: Array<[string, string]> = [
  ["/settings", "Overview"],
  ["/settings/organization", "Organization"],
  ["/settings/team", "Team"],
  ["/settings/roles", "Roles"],
  ["/settings/invitations", "Invitations"],
  ["/settings/access", "Farm access"],
  ["/settings/profile", "Profile"],
];

function NavItem({
  to,
  end,
  onClick,
  children,
  indent,
}: {
  to: string;
  end?: boolean;
  onClick?: () => void;
  children: ReactNode;
  indent?: boolean;
}) {
  return (
    <RouterNavLink to={to} end={end} onClick={onClick} style={{ textDecoration: "none" }}>
      {({ isActive }) => (
        <Flex
          align="center"
          gap={3}
          px={3}
          py={2}
          ml={indent ? 8 : 0}
          borderRadius="md"
          fontSize="sm"
          fontWeight={isActive ? "semibold" : "normal"}
          bg={isActive ? "whiteAlpha.200" : "transparent"}
          color={isActive ? "white" : "whiteAlpha.800"}
          _hover={{ bg: "whiteAlpha.200", color: "white" }}
        >
          {children}
        </Flex>
      )}
    </RouterNavLink>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="whiteAlpha.500" px={3} pt={4} pb={1}>
      {children}
    </Text>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const [cropsOpen, setCropsOpen] = useState(location.pathname.startsWith("/crops"));
  const [settingsOpen, setSettingsOpen] = useState(location.pathname.startsWith("/settings"));

  const groupButtonProps = {
    variant: "ghost" as const,
    colorScheme: "whiteAlpha" as const,
    justifyContent: "flex-start" as const,
    fontWeight: "normal" as const,
    fontSize: "sm" as const,
    color: "whiteAlpha.800",
    _hover: { bg: "whiteAlpha.200", color: "white" },
    w: "100%",
    px: 3,
  };

  return (
    <Flex direction="column" h="100%" bg="brand.800" color="white">
      <Flex align="center" gap={3} px={4} py={5}>
        <Flex boxSize={9} align="center" justify="center" borderRadius="lg" bg="brand.500">
          <Leaf size={18} />
        </Flex>
        <Box lineHeight="short">
          <Text fontFamily="heading" fontWeight="semibold">
            AgriNexa
          </Text>
          <Text fontSize="xs" color="whiteAlpha.600">
            Operations
          </Text>
        </Box>
      </Flex>
      <Stack as="nav" aria-label="Primary" spacing={0.5} px={2} flex="1" overflowY="auto" pb={4}>
        <GroupLabel>Overview</GroupLabel>
        {main.map((item) => (
          <NavItem key={item.to} to={item.to} end={item.end} onClick={onNavigate}>
            <item.icon size={18} />
            {item.label}
          </NavItem>
        ))}
        <Button {...groupButtonProps} onClick={() => setCropsOpen((v) => !v)} leftIcon={<Sprout size={18} />}>
          Crops
          <Box flex="1" />
          <Box as="span" transform={cropsOpen ? "rotate(180deg)" : undefined} transition="transform 0.15s">
            <ChevronDown size={14} />
          </Box>
        </Button>
        <Collapse in={cropsOpen}>
          <Stack spacing={0.5}>
            {cropChildren.map((c) => (
              <NavItem key={c.to} to={c.to} end={c.end} onClick={onNavigate} indent>
                {c.label}
              </NavItem>
            ))}
          </Stack>
        </Collapse>
        <GroupLabel>Operations</GroupLabel>
        {ops.map((item) => (
          <NavItem key={item.to} to={item.to} onClick={onNavigate}>
            <item.icon size={18} />
            {item.label}
          </NavItem>
        ))}
        <GroupLabel>Records</GroupLabel>
        {insight.map((item) => (
          <NavItem key={item.to} to={item.to} onClick={onNavigate}>
            <item.icon size={18} />
            {item.label}
          </NavItem>
        ))}
        <GroupLabel>Admin</GroupLabel>
        <Button {...groupButtonProps} onClick={() => setSettingsOpen((v) => !v)} leftIcon={<Settings size={18} />}>
          Settings
          <Box flex="1" />
          <Box as="span" transform={settingsOpen ? "rotate(180deg)" : undefined} transition="transform 0.15s">
            <ChevronDown size={14} />
          </Box>
        </Button>
        <Collapse in={settingsOpen}>
          <Stack spacing={0.5}>
            {settingsChildren.map(([to, label]) => (
              <NavItem key={to} to={to} end={to === "/settings"} onClick={onNavigate} indent>
                {label}
              </NavItem>
            ))}
          </Stack>
        </Collapse>
      </Stack>
      <Text fontSize="xs" color="whiteAlpha.500" px={4} py={3}>
        Precision farming, unified.
      </Text>
    </Flex>
  );
}

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const isMobile = useBreakpointValue({ base: true, lg: false });
  const close = () => setSidebarOpen(false);

  if (isMobile) {
    return (
      <Drawer isOpen={sidebarOpen} onClose={close} placement="left">
        <DrawerOverlay />
        <DrawerContent maxW="264px">
          <DrawerBody p={0}>
            <SidebarContent onNavigate={close} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Box as="aside" w="264px" flexShrink={0} position="sticky" top={0} h="100vh">
      <SidebarContent />
    </Box>
  );
}
