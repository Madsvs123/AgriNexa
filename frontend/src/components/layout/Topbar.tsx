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
  Select,
  Text,
  useColorMode,
  VisuallyHidden,
} from "@chakra-ui/react";
import { Bell, Check, ChevronDown, Menu as MenuIcon, Moon, Search, Sun } from "lucide-react";
import { authApi, cropsApi, platformApi } from "@/api/client";
import { REFRESH_KEY, useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { displayName, fromNow } from "@/lib/utils";
import { NotificationPanel } from "./NotificationPanel";

export function OrgSwitcher() {
  const orgs = useAuthStore((s) => s.organizations);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const setOrg = useAuthStore((s) => s.setOrg);
  const current = orgs.find((o) => o.id === currentOrgId);
  return (
    <Menu>
      <MenuButton as={Button} variant="ghost" colorScheme="gray" rightIcon={<ChevronDown size={14} />}>
        <Text as="span" display={{ base: "none", md: "inline" }}>
          {current?.name ?? "Organization"}
        </Text>
      </MenuButton>
      <MenuList>
        {orgs.map((o) => (
          <MenuItem key={o.id} onClick={() => setOrg(o.id)} icon={o.id === currentOrgId ? <Check size={14} /> : undefined}>
            {o.name}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
}

export function Topbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setCommandPalette = useUiStore((s) => s.setCommandPalette);
  const seasonId = useUiStore((s) => s.seasonId);
  const setSeasonId = useUiStore((s) => s.setSeasonId);
  const { colorMode, toggleColorMode } = useColorMode();

  const seasonsQ = useQuery({
    queryKey: ["seasons"],
    queryFn: () => cropsApi.seasons(),
  });
  const notifQ = useQuery({
    queryKey: ["notifications"],
    queryFn: () => platformApi.notifications(),
  });
  const unread = (notifQ.data?.results ?? []).some((n) => !n.is_read);

  return (
    <Flex
      as="header"
      align="center"
      gap={3}
      px={{ base: 4, md: 6 }}
      py={3}
      bg="bg.surface"
      borderBottomWidth="1px"
      borderColor="border.default"
      position="sticky"
      top={0}
      zIndex={10}
    >
      <IconButton
        aria-label="Open navigation"
        icon={<MenuIcon size={20} />}
        variant="ghost"
        colorScheme="gray"
        display={{ base: "inline-flex", lg: "none" }}
        onClick={toggleSidebar}
      />
      <Button
        variant="outline"
        colorScheme="gray"
        fontWeight="normal"
        color="fg.muted"
        leftIcon={<Search size={16} />}
        onClick={() => setCommandPalette(true)}
        flex={{ base: 1, md: "0 1 360px" }}
        justifyContent="flex-start"
      >
        <Text as="span" flex="1" textAlign="left" display={{ base: "none", sm: "inline" }}>
          Search fields, equipment, inventory…
        </Text>
        <Kbd display={{ base: "none", md: "inline-flex" }}>Ctrl K</Kbd>
      </Button>
      <Box flex="1" />
      <HStack spacing={2}>
        <OrgSwitcher />
        <VisuallyHidden>
          <label htmlFor="season-filter">Season</label>
        </VisuallyHidden>
        <Select
          id="season-filter"
          w="150px"
          display={{ base: "none", md: "block" }}
          value={seasonId ?? ""}
          onChange={(e) => setSeasonId(e.target.value || null)}
        >
          <option value="">All seasons</option>
          {(seasonsQ.data?.results ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <IconButton
          aria-label={colorMode === "light" ? "Switch to dark mode" : "Switch to light mode"}
          icon={colorMode === "light" ? <Moon size={18} /> : <Sun size={18} />}
          variant="ghost"
          colorScheme="gray"
          onClick={toggleColorMode}
        />
        <Popover placement="bottom-end">
          <PopoverTrigger>
            <Box position="relative">
              <IconButton aria-label="Notifications" icon={<Bell size={18} />} variant="ghost" colorScheme="gray" />
              {unread ? (
                <Box position="absolute" top={1.5} right={1.5} boxSize={2} borderRadius="full" bg="red.500" />
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
          <MenuButton as={Button} variant="ghost" colorScheme="gray" rightIcon={<ChevronDown size={14} />}>
            <HStack spacing={2}>
              <Avatar size="sm" name={displayName(user?.first_name, user?.last_name, user?.email)} bg="brand.500" />
              <Text as="span" display={{ base: "none", md: "inline" }}>
                {displayName(user?.first_name, user?.last_name, user?.email)}
              </Text>
            </HStack>
          </MenuButton>
          <MenuList>
            <MenuItem onClick={() => navigate("/settings/profile")}>Farmer profile</MenuItem>
            <MenuItem onClick={() => navigate("/settings/organization")}>Organization</MenuItem>
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
            <MenuDivider />
            <Box px={3} py={1}>
              <Text fontSize="xs" color="fg.muted">
                {user?.email} · joined {fromNow(user?.date_joined)}
              </Text>
            </Box>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
}
