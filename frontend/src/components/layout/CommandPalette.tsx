import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Kbd,
  Modal,
  ModalContent,
  ModalOverlay,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { ArrowRight, Clock, Plus, Search, Zap } from "lucide-react";
import { platformApi } from "@/api/client";
import { useUiStore, type RecentEntry } from "@/stores/uiStore";
import { useDebounced } from "@/hooks/useDebounced";
import { PALETTE_ROUTES, scoreRoute } from "@/navigation/manifest";

type ItemKind = "recent" | "route" | "action" | "record";

interface PaletteItem {
  key: string;
  label: string;
  hint?: string;
  group: string;
  kind: ItemKind;
  run: () => void;
  /** Recorded in recents when chosen. */
  recent?: RecentEntry;
}

const ACTIONS: Array<{ id: string; label: string; path: string; keywords: string[] }> = [
  { id: "new-field", label: "New field", path: "/fields/new", keywords: ["add", "create", "boundary"] },
  { id: "new-farm", label: "New farm", path: "/farms/new", keywords: ["add", "create", "property"] },
  {
    id: "new-scout",
    label: "New scout report",
    path: "/scouting/new",
    keywords: ["add", "create", "pest", "walk"],
  },
];

const RECORD_GROUPS = [
  { key: "farms", label: "Farms", to: (id: string) => `/farms/${id}` },
  { key: "fields", label: "Fields", to: (id: string) => `/fields/${id}` },
  { key: "equipment", label: "Equipment", to: (id: string) => `/equipment/${id}` },
  { key: "inventory", label: "Inventory", to: (id: string) => `/inventory/${id}` },
  { key: "crops", label: "Crops", to: () => "/crops" },
  { key: "tasks", label: "Tasks", to: () => "/tasks" },
] as const;

const KIND_ICON: Record<ItemKind, typeof Search> = {
  recent: Clock,
  route: ArrowRight,
  action: Plus,
  record: Search,
};

/**
 * Command palette: go-to navigation, quick actions, and record search.
 *
 * Replaces a search modal that only looked up records, had no keyboard
 * navigation, fired a request per keystroke, and whose Enter key always
 * dumped you on the full search page regardless of what was highlighted.
 */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandPalette);
  const setOpen = useUiStore((s) => s.setCommandPalette);
  const recents = useUiStore((s) => s.recents);
  const pushRecent = useUiStore((s) => s.pushRecent);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  // `>` restricts to actions, `#` to records — mirrors common palette grammar.
  const mode = trimmed.startsWith(">") ? "actions" : trimmed.startsWith("#") ? "records" : "all";
  const term = mode === "all" ? trimmed : trimmed.slice(1).trim();
  const debouncedTerm = useDebounced(term, 250);

  const searchEnabled = open && mode !== "actions" && debouncedTerm.length > 1;
  const searchQ = useQuery({
    queryKey: ["search", debouncedTerm],
    queryFn: () => platformApi.search(debouncedTerm),
    enabled: searchEnabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const items = useMemo<PaletteItem[]>(() => {
    const go = (path: string, recent: RecentEntry) => () => {
      pushRecent(recent);
      setOpen(false);
      navigate(path);
    };

    // Empty query: offer recents, then the full destination list.
    if (!term) {
      const out: PaletteItem[] = [];
      if (mode !== "actions") {
        for (const r of recents) {
          out.push({
            key: `recent:${r.path}`,
            label: r.label,
            hint: r.group,
            group: "Recent",
            kind: "recent",
            run: go(r.path, r),
          });
        }
      }
      if (mode !== "records") {
        for (const a of ACTIONS) {
          out.push({
            key: `action:${a.id}`,
            label: a.label,
            group: "Actions",
            kind: "action",
            run: go(a.path, { id: a.id, label: a.label, path: a.path, group: "Actions" }),
          });
        }
      }
      if (mode === "all") {
        for (const route of PALETTE_ROUTES) {
          out.push({
            key: `route:${route.id}`,
            label: route.label,
            hint: route.section,
            group: "Go to",
            kind: "route",
            run: go(route.path, {
              id: route.id,
              label: route.label,
              path: route.path,
              group: "Go to",
            }),
          });
        }
      }
      return out;
    }

    const out: PaletteItem[] = [];

    if (mode !== "records") {
      const actionHits = ACTIONS.filter(
        (a) =>
          a.label.toLowerCase().includes(term.toLowerCase()) ||
          a.keywords.some((k) => k.includes(term.toLowerCase())),
      );
      for (const a of actionHits) {
        out.push({
          key: `action:${a.id}`,
          label: a.label,
          group: "Actions",
          kind: "action",
          run: go(a.path, { id: a.id, label: a.label, path: a.path, group: "Actions" }),
        });
      }
    }

    if (mode === "all") {
      const scored = PALETTE_ROUTES.map((r) => ({ route: r, score: scoreRoute(r, term) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || a.route.label.localeCompare(b.route.label))
        .slice(0, 6);
      for (const { route } of scored) {
        out.push({
          key: `route:${route.id}`,
          label: route.label,
          hint: route.section,
          group: "Go to",
          kind: "route",
          run: go(route.path, {
            id: route.id,
            label: route.label,
            path: route.path,
            group: "Go to",
          }),
        });
      }
    }

    if (mode !== "actions" && searchQ.data) {
      for (const group of RECORD_GROUPS) {
        const rows = searchQ.data[group.key] ?? [];
        for (const row of rows) {
          const record = row as unknown as Record<string, unknown>;
          const id = String(record.id);
          const label = String(record.name ?? record.title ?? "Untitled");
          const path = group.to(id);
          const hintParts = [
            record.farm_name,
            record.code,
            record.sku,
            record.serial,
            record.status,
          ].filter((v): v is string => typeof v === "string" && v.length > 0);
          out.push({
            key: `record:${group.key}:${id}`,
            label,
            hint: hintParts.slice(0, 2).join(" · ") || undefined,
            group: group.label,
            kind: "record",
            run: go(path, { id: `record:${id}`, label, path, group: group.label }),
          });
        }
      }
    }

    return out;
  }, [term, mode, recents, searchQ.data, navigate, pushRecent, setOpen]);

  // Keep the highlight in range as results stream in.
  useEffect(() => {
    setCursor((c) => (items.length === 0 ? 0 : Math.min(c, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  // Global Ctrl/Cmd+K, and "/" as a shortcut when not already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      if (e.key === "/" && !open) {
        const el = e.target as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => (items.length ? (c + 1) % items.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => (items.length ? (c - 1 + items.length) % items.length : 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setCursor(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCursor(Math.max(0, items.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[cursor];
        if (item) item.run();
        else if (term) {
          setOpen(false);
          navigate(`/search?q=${encodeURIComponent(term)}`);
        }
      }
    },
    [items, cursor, term, navigate, setOpen],
  );

  // Keep the highlighted row scrolled into view during keyboard traversal.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let lastGroup = "";

  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent mt="8vh" bg="bg.surface" overflow="hidden">
        <InputGroup>
          <InputLeftElement h="56px" pl={2} color="fg.muted">
            {searchQ.isFetching ? <Spinner size="sm" /> : <Search size={18} aria-hidden />}
          </InputLeftElement>
          <Input
            autoFocus
            variant="unstyled"
            h="56px"
            pl="44px"
            pr={4}
            fontSize="md"
            placeholder="Search records, or jump to a page…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search or jump to a page"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={items[cursor] ? `palette-item-${cursor}` : undefined}
            role="combobox"
          />
        </InputGroup>

        <Box
          borderTopWidth="1px"
          borderColor="border.default"
          maxH="56vh"
          overflowY="auto"
          ref={listRef}
          id="palette-results"
          role="listbox"
          aria-label="Results"
        >
          {items.map((item, index) => {
            const showHeader = item.group !== lastGroup;
            lastGroup = item.group;
            const Icon = KIND_ICON[item.kind];
            const active = index === cursor;
            return (
              <Box key={item.key}>
                {showHeader ? (
                  <Text
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    color="fg.muted"
                    px={4}
                    pt={3}
                    pb={1}
                  >
                    {item.group}
                  </Text>
                ) : null}
                <Flex
                  as="button"
                  type="button"
                  data-index={index}
                  id={`palette-item-${index}`}
                  role="option"
                  aria-selected={active}
                  w="100%"
                  align="center"
                  gap={3}
                  textAlign="left"
                  px={4}
                  py={2}
                  bg={active ? "bg.subtle" : "transparent"}
                  borderLeftWidth="2px"
                  borderLeftColor={active ? "brand.500" : "transparent"}
                  _hover={{ bg: "bg.subtle" }}
                  onMouseEnter={() => setCursor(index)}
                  onClick={item.run}
                >
                  <Box color="fg.muted" flexShrink={0}>
                    <Icon size={15} aria-hidden />
                  </Box>
                  <Text as="span" flex="1" noOfLines={1}>
                    {item.label}
                  </Text>
                  {item.hint ? (
                    <Badge variant="subtle" colorScheme="gray" textTransform="none" fontWeight="normal">
                      {item.hint}
                    </Badge>
                  ) : null}
                </Flex>
              </Box>
            );
          })}

          {!items.length ? (
            <Box px={4} py={6}>
              <Text color="fg.muted" fontSize="sm">
                {searchQ.isFetching
                  ? "Searching…"
                  : term.length === 1
                    ? "Keep typing — record search starts at two characters."
                    : `No matches for “${term}”. Press Enter for the full search page.`}
              </Text>
            </Box>
          ) : null}
        </Box>

        <Flex
          align="center"
          gap={4}
          px={4}
          py={2}
          borderTopWidth="1px"
          borderColor="border.default"
          bg="bg.subtle"
          fontSize="xs"
          color="fg.muted"
          flexWrap="wrap"
        >
          <Flex align="center" gap={1}>
            <Kbd fontSize="10px">↑</Kbd>
            <Kbd fontSize="10px">↓</Kbd> navigate
          </Flex>
          <Flex align="center" gap={1}>
            <Kbd fontSize="10px">↵</Kbd> open
          </Flex>
          <Flex align="center" gap={1}>
            <Kbd fontSize="10px">esc</Kbd> close
          </Flex>
          <Box flex="1" />
          <Flex align="center" gap={1}>
            <Zap size={11} aria-hidden /> <Kbd fontSize="10px">&gt;</Kbd> actions
            <Kbd fontSize="10px" ml={1}>
              #
            </Kbd>{" "}
            records
          </Flex>
        </Flex>
      </ModalContent>
    </Modal>
  );
}
