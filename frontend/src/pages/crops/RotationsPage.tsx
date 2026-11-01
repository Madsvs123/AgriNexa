import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Box, Button, Card, CardBody, Flex, Heading, Input, Select, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { ListPage } from "@/components/templates/ListPage";
import { EmptyState } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { CropChip } from "@/components/planning/CropChip";
import { useScope } from "@/hooks/useScope";
import type { Rotation } from "@/types";

function StepTimeline({ rotation }: { rotation: Rotation }) {
  const years = Array.from({ length: Math.max(rotation.cycle_years, 1) }, (_, i) => i);
  return (
    <SimpleGrid columns={{ base: 1, sm: Math.min(years.length, 2), md: Math.min(years.length, 4) }} spacing={2}>
      {years.map((y) => {
        const steps = rotation.steps.filter((s) => s.year_offset === y);
        return (
          <Box key={y} p={2.5} bg="bg.subtle" borderRadius="md" minH="64px">
            <Text fontSize="xs" color="fg.muted" mb={1.5}>
              Year {y + 1}
              {rotation.start_year ? ` · ${rotation.start_year + y}` : ""}
            </Text>
            <Stack spacing={1}>
              {steps.map((s) => (
                <Flex key={s.id} align="center" gap={2}>
                  <CropChip name={s.crop_name ?? "Fallow"} color={s.crop_color} size="xs" />
                  {s.role !== "main" ? (
                    <Badge fontSize="9px" variant="outline" colorScheme="gray" textTransform="capitalize">
                      {s.role}
                    </Badge>
                  ) : null}
                  {s.companion_names?.length ? (
                    <Text fontSize="xs" color="fg.muted">
                      + {s.companion_names.join(", ")}
                    </Text>
                  ) : null}
                </Flex>
              ))}
              {!steps.length ? (
                <Text fontSize="xs" color="fg.muted">
                  empty
                </Text>
              ) : null}
            </Stack>
          </Box>
        );
      })}
    </SimpleGrid>
  );
}

export default function RotationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { params: scopeParams, farmId } = useScope();
  const rotQ = useQuery({
    queryKey: ["rotations", scopeParams],
    queryFn: () => cropsApi.rotations(scopeParams.farm ? { farm: scopeParams.farm } : undefined),
  });
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [farm, setFarm] = useState("");
  const [startYear, setStartYear] = useState(String(new Date().getFullYear()));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      cropsApi.createRotation({ name, farm: farm || farmId || undefined, start_year: Number(startYear) || null, notes, is_active: true }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["rotations"] });
      setOpen(false);
      navigate(`/crops/rotations/${r.id}`);
    },
    onError: (e) => setError(getApiError(e)),
  });

  const rotations = rotQ.data?.results ?? [];

  return (
    <ListPage
      title="Rotations"
      subtitle="Multi-year crop sequences with cover crops and companions, assigned to fields and staggered by phase."
      error={rotQ.error ? getApiError(rotQ.error) : null}
      loading={rotQ.isLoading}
      actions={
        <Button
          colorScheme="brand"
          onClick={() => {
            setFarm(farmId ?? farmsQ.data?.results[0]?.id ?? "");
            setName("");
            setNotes("");
            setError(null);
            setOpen(true);
          }}
        >
          New rotation
        </Button>
      }
    >
      {!rotations.length ? (
        <Card variant="surface">
          <EmptyState title="No rotations defined" body="Build a corn–soy–wheat cycle, add a rye cover after corn, then assign fields." />
        </Card>
      ) : (
        <Stack spacing={4}>
          {rotations.map((r) => (
            <Card
              key={r.id}
              variant="surface"
              as="button"
              textAlign="start"
              onClick={() => navigate(`/crops/rotations/${r.id}`)}
              _hover={{ borderColor: "brand.300" }}
              transition="border-color 0.15s"
            >
              <CardBody>
                <Flex align="center" gap={3} mb={3} wrap="wrap">
                  <Heading size="sm">{r.name}</Heading>
                  <Text color="fg.muted" fontSize="sm">
                    {r.farm_name} · {r.cycle_years}-year cycle · {r.fields.length} field{r.fields.length === 1 ? "" : "s"}
                  </Text>
                  {!r.is_active ? <Badge colorScheme="gray">inactive</Badge> : null}
                  {!r.steps.length ? <Badge colorScheme="yellow">no steps yet</Badge> : null}
                </Flex>
                <StepTimeline rotation={r} />
                {r.notes ? (
                  <Text color="fg.muted" fontSize="sm" mt={3}>
                    {r.notes}
                  </Text>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </Stack>
      )}

      <Drawer open={open} title="New rotation" onClose={() => setOpen(false)}>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Name" htmlFor="r-name">
            <Input id="r-name" isRequired value={name} onChange={(e) => setName(e.target.value)} placeholder="Corn–Soy–Wheat + rye cover" />
          </FormField>
          <FormField label="Farm" htmlFor="r-farm">
            <Select id="r-farm" value={farm} onChange={(e) => setFarm(e.target.value)} isRequired>
              <option value="">Select farm</option>
              {(farmsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Year of step 1" htmlFor="r-year" hint="Anchors the cycle to the calendar; fields can be phase-shifted">
            <Input id="r-year" type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)} />
          </FormField>
          <FormField label="Notes" htmlFor="r-notes">
            <Textarea id="r-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </FormField>
          <Button type="submit" colorScheme="brand" isDisabled={create.isPending || !name || !farm}>
            {create.isPending ? "Creating…" : "Create and add steps"}
          </Button>
        </form>
      </Drawer>
    </ListPage>
  );
}
