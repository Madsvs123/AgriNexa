import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  Text,
} from "@chakra-ui/react";
import { platformApi } from "@/api/client";
import { useUiStore } from "@/stores/uiStore";

export function SearchPalette() {
  const open = useUiStore((s) => s.commandPalette);
  const setOpen = useUiStore((s) => s.setCommandPalette);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const searchQ = useQuery({
    queryKey: ["search", q],
    queryFn: () => platformApi.search(q),
    enabled: open && q.trim().length > 1,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const groups = useMemo(() => {
    const data = searchQ.data;
    if (!data) return [];
    return [
      { label: "Farms", items: (data.farms ?? []).map((x) => ({ id: x.id, name: x.name, to: `/farms/${x.id}` })) },
      { label: "Fields", items: (data.fields ?? []).map((x) => ({ id: x.id, name: x.name, to: `/fields/${x.id}` })) },
      {
        label: "Equipment",
        items: (data.equipment ?? []).map((x) => ({ id: x.id, name: x.name, to: `/equipment/${x.id}` })),
      },
      {
        label: "Inventory",
        items: (data.inventory ?? []).map((x) => ({ id: x.id, name: x.name, to: `/inventory/${x.id}` })),
      },
      { label: "Tasks", items: (data.tasks ?? []).map((x) => ({ id: x.id, name: x.title, to: "/tasks" })) },
    ].filter((g) => g.items.length);
  }, [searchQ.data]);

  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} size="xl">
      <ModalOverlay />
      <ModalContent mt="10vh" bg="bg.surface">
        <ModalBody p={0}>
          <Input
            variant="flushed"
            px={5}
            py={6}
            autoFocus
            placeholder="Search North Ridge, Planter 12, MAP 11-52-0…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) {
                setOpen(false);
                navigate(`/search?q=${encodeURIComponent(q)}`);
              }
            }}
            aria-label="Search"
          />
          <Box maxH="50vh" overflowY="auto" pb={2}>
            {q.trim().length < 2 ? (
              <Text color="fg.muted" p={4} fontSize="sm">
                Type at least two characters, or press Enter for the full search page.
              </Text>
            ) : null}
            {groups.map((g) => (
              <Box key={g.label}>
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  color="fg.muted"
                  px={5}
                  pt={3}
                  pb={1}
                >
                  {g.label}
                </Text>
                {g.items.map((item) => (
                  <Box
                    key={item.id}
                    as="button"
                    w="100%"
                    textAlign="left"
                    px={5}
                    py={2}
                    _hover={{ bg: "bg.subtle" }}
                    onClick={() => {
                      setOpen(false);
                      navigate(item.to);
                    }}
                  >
                    {item.name}
                  </Box>
                ))}
              </Box>
            ))}
            {searchQ.isFetched && q.trim().length > 1 && !groups.length ? (
              <Text color="fg.muted" p={4} fontSize="sm">
                No matches for “{q}”. Try a farm code, SKU, or field name.
              </Text>
            ) : null}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
