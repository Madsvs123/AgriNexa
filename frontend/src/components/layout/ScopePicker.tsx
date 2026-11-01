import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Divider,
  Flex,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { cropsApi, farmsApi } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useScope } from "@/hooks/useScope";

function useScopeOptions() {
  const farmsQ = useQuery({
    queryKey: ["farms", "scope"],
    queryFn: () => farmsApi.list(),
    staleTime: 5 * 60_000,
  });
  const seasonsQ = useQuery({
    queryKey: ["seasons", "scope"],
    queryFn: () => cropsApi.seasons(),
    staleTime: 5 * 60_000,
  });
  return {
    farms: farmsQ.data?.results ?? [],
    seasons: seasonsQ.data?.results ?? [],
  };
}

/**
 * The one control for "what am I looking at".
 *
 * Replaces a separate org menu and a bare season `<Select>` that sat in the
 * topbar beside the theme toggle and avatar, mixing data scope with identity
 * and appearance controls.
 */
export function ScopePicker() {
  const orgs = useAuthStore((s) => s.organizations);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const setOrg = useAuthStore((s) => s.setOrg);
  const { farmId, seasonId, applies, setFarmId, setSeasonId } = useScope();
  const { farms, seasons } = useScopeOptions();
  const { t } = useTranslation("nav");

  const org = orgs.find((o) => o.id === currentOrgId);
  const farm = farms.find((f) => f.id === farmId);
  const season = seasons.find((s) => s.id === seasonId);

  // Only summarise dimensions the current route actually uses.
  const parts = [org?.name ?? t("shell.organization")];
  if (applies.includes("farm")) parts.push(farm?.name ?? t("shell.allFarms"));
  if (applies.includes("season")) parts.push(season?.name ?? t("shell.allSeasons"));

  return (
    <Popover placement="bottom-start">
      <PopoverTrigger>
        <Button
          variant="ghost"
          colorScheme="gray"
          size="sm"
          fontWeight="normal"
          leftIcon={<SlidersHorizontal size={14} />}
          rightIcon={<ChevronDown size={14} />}
          maxW={{ base: "180px", md: "none" }}
        >
          <Text as="span" noOfLines={1}>
            {parts.join(" · ")}
          </Text>
        </Button>
      </PopoverTrigger>
      <PopoverContent bg="bg.surface" w="300px">
        <PopoverArrow bg="bg.surface" />
        <PopoverBody>
          <Stack spacing={3}>
            <Box>
              <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mb={1.5}>
                {t("shell.organization")}
              </Text>
              <Stack spacing={0.5}>
                {orgs.map((o) => (
                  <Flex
                    key={o.id}
                    as="button"
                    type="button"
                    align="center"
                    gap={2}
                    px={2}
                    py={1.5}
                    borderRadius="md"
                    fontSize="sm"
                    textAlign="start"
                    bg={o.id === currentOrgId ? "bg.subtle" : "transparent"}
                    _hover={{ bg: "bg.subtle" }}
                    onClick={() => setOrg(o.id)}
                  >
                    <Box boxSize={3.5}>{o.id === currentOrgId ? <Check size={14} /> : null}</Box>
                    {o.name}
                  </Flex>
                ))}
              </Stack>
            </Box>

            {applies.length ? <Divider /> : null}

            {applies.includes("farm") ? (
              <Box>
                <Text as="label" htmlFor="scope-farm" fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" display="block" mb={1.5}>
                  {t("labels.farm", { ns: "common" })}
                </Text>
                <Select
                  id="scope-farm"
                  size="sm"
                  value={farmId ?? ""}
                  onChange={(e) => setFarmId(e.target.value || null)}
                >
                  <option value="">{t("shell.allFarms")}</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </Box>
            ) : null}

            {applies.includes("season") ? (
              <Box>
                <Text as="label" htmlFor="scope-season" fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" display="block" mb={1.5}>
                  {t("labels.season", { ns: "common" })}
                </Text>
                <Select
                  id="scope-season"
                  size="sm"
                  value={seasonId ?? ""}
                  onChange={(e) => setSeasonId(e.target.value || null)}
                >
                  <option value="">{t("shell.allSeasons")}</option>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Box>
            ) : null}

            {!applies.length ? (
              <Text fontSize="sm" color="fg.muted">
                {t("shell.orgWidePage")}
              </Text>
            ) : null}
          </Stack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The same scope controls rendered inline at the foot of the section panel,
 * where they read as "filters for this section" rather than global chrome.
 */
export function ScopeFilters() {
  const { farmId, seasonId, applies, setFarmId, setSeasonId } = useScope();
  const { farms, seasons } = useScopeOptions();
  const { t } = useTranslation("nav");

  if (!applies.length) return null;

  return (
    <Box px={3} py={3} borderTopWidth="1px" borderColor="border.default">
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mb={2}>
        {t("shell.scope")}
      </Text>
      <Stack spacing={2}>
        {applies.includes("farm") ? (
          <Select
            size="sm"
            value={farmId ?? ""}
            onChange={(e) => setFarmId(e.target.value || null)}
            aria-label={t("labels.farm", { ns: "common" })}
          >
            <option value="">{t("shell.allFarms")}</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        ) : null}
        {applies.includes("season") ? (
          <Select
            size="sm"
            value={seasonId ?? ""}
            onChange={(e) => setSeasonId(e.target.value || null)}
            aria-label={t("labels.season", { ns: "common" })}
          >
            <option value="">{t("shell.allSeasons")}</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        ) : null}
      </Stack>
    </Box>
  );
}
