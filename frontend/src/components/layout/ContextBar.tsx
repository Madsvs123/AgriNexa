import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Kbd,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import {
  Bell,
  ChevronDown,
  Menu as MenuIcon,
  Moon,
  PanelLeft,
  Search,
  Sun,
} from "lucide-react";
import { authApi, platformApi } from "@/api/client";
import { REFRESH_KEY, useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { displayName, fromNow } from "@/lib/utils";
import { NotificationPanel } from "./NotificationPanel";
import { Breadcrumbs } from "./Breadcrumbs";
import { ScopePicker } from "./ScopePicker";
import { layout } from "@/theme";

/**
 * Slim header: breadcrumbs, scope, search, notifications, account.
 *
 * The old topbar carried seven controls at equal weight. The theme toggle moved
 * into the account menu (a once-a-month control should not hold permanent
 * space) and org/season folded into the single scope control.
 */
export function ContextBar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const toggleNavDrawer = useUiStore((s) => s.toggleNavDrawer);
  const toggleSectionPanel = useUiStore((s) => s.toggleSectionPanel);
  const setCommandPalette = useUiStore((s) => s.setCommandPalette);
  const { colorMode, toggleColorMode } = useColorMode();

  const notifQ = useQuery({
    queryKey: ["notifications"],
    queryFn: () => platformApi.notifications(),
  });
  const unreadCount = (notifQ.data?.results ?? []).filter((n) => !n.is_read).length;

  return (
    <Flex
      as="header"
      align="center"
      gap={2}
      px={{ base: 3, md: 4 }}
      h={layout.contextBarHeight}
      flexShrink={0}
      bg="bg.surface"
      borderBottomWidth="1px"
      borderColor="border.default"
      position="sticky"
      top={0}
      zIndex="sticky"
    >
      <IconButton
        aria-label="Open navigation"
        icon={<MenuIcon size={20} />}
        variant="ghost"
        colorScheme="gray"
        size="sm"
        display={{ base: "inline-flex", lg: "none" }}
        onClick={toggleNavDrawer}
      />
      <IconButton
        aria-label="Toggle section panel"
        icon={<PanelLeft size={18} />}
        variant="ghost"
        colorScheme="gray"
        size="sm"
        display={{ base: "none", lg: "inline-flex" }}
        onClick={toggleSectionPanel}
      />

      <Box minW={0} display={{ base: "none", sm: "block" }}>
        <Breadcrumbs />
      </Box>

      <Box flex="1" minW={2} />

      <ScopePicker />

      <Button
        variant="outline"
        colorScheme="gray"
        size="sm"
        fontWeight="normal"
        color="fg.muted"
        leftIcon={<Search size={15} />}
        onClick={() => setCommandPalette(true)}
        w={{ base: "auto", md: "260px" }}
        justifyContent="flex-start"
      >
        <Text as="span" flex="1" textAlign="left" display={{ base: "none", md: "inline" }}>
          Search or jump to…
        </Text>
        <Kbd display={{ base: "none", md: "inline-flex" }} fontSize="10px">
          Ctrl K
        </Kbd>
      </Button>

      <HStack spacing={1}>
        <Popover placement="bottom-end">
          <PopoverTrigger>
            <Box position="relative">
              <IconButton
                aria-label={unreadCount ? `Notifications (${unreadCount} unread)` : "Notifications"}
                icon={<Bell size={18} />}
                variant="ghost"
                colorScheme="gray"
                size="sm"
              />
              {unreadCount ? (
                <Box
                  position="absolute"
                  top={1}
                  right={1}
                  boxSize={2}
                  borderRadius="full"
                  bg="red.500"
                  pointerEvents="none"
                />
              ) : null}
            </Box>
          </PopoverTrigger>
          <PopoverContent w="340px" bg="bg.surface">
            <PopoverBody p={0}>
              <NotificationPanel
                items={(notifQ.data?.results ?? []).slice(0, 8)}
                onSeeAll={() => navigate("/notifications")}
              />
            </PopoverBody>
          </PopoverContent>
        </Popover>

        <Menu>
          <MenuButton
            as={Button}
            variant="ghost"
            colorScheme="gray"
            size="sm"
            px={1.5}
            rightIcon={<ChevronDown size={14} />}
          >
            <Avatar
              size="xs"
              name={displayName(user?.first_name, user?.last_name, user?.email)}
              bg="brand.500"
            />
          </MenuButton>
          <MenuList>
            <Box px={3} py={2}>
              <Text fontSize="sm" fontWeight="semibold">
                {displayName(user?.first_name, user?.last_name, user?.email)}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {user?.email} · joined {fromNow(user?.date_joined)}
              </Text>
            </Box>
            <MenuDivider />
            <MenuItem onClick={() => navigate("/settings/profile")}>Farmer profile</MenuItem>
            <MenuItem onClick={() => navigate("/settings/organization")}>Organization</MenuItem>
            <MenuItem
              icon={colorMode === "light" ? <Moon size={14} /> : <Sun size={14} />}
              onClick={toggleColorMode}
              closeOnSelect={false}
            >
              {colorMode === "light" ? "Dark mode" : "Light mode"}
            </MenuItem>
            <MenuDivider />
            <MenuItem
              onClick={() => {
                const refresh = localStorage.getItem(REFRESH_KEY);
                if (refresh) void authApi.logout(refresh).catch(() => undefined);
                logout();
                navigate("/signin");
              }}
            >
              Sign out
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
}
