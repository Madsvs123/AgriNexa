import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Box, Button, Card, CardBody, Flex, Heading, Input, Select, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { ListPage } from "@/components/templates/ListPage";
import { EmptyState } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { CropChip } from "@/components/planning/CropChip";
import { useScope } from "@/hooks/useScope";
import type { Rotation } from "@/types";
import { usePlanningLabels } from "@/lib/usePlanningLabels";

function StepTimeline({ rotation }: { rotation: Rotation }) {
  const { t } = useTranslation("grow");
  const labels = usePlanningLabels();
  const years = Array.from({ length: Math.max(rotation.cycle_years, 1) }, (_, i) => i);
  return (
    <SimpleGrid columns={{ base: 1, sm: Math.min(years.length, 2), md: Math.min(years.length, 4) }} spacing={2}>
      {years.map((y) => {
        const steps = rotation.steps.filter((s) => s.year_offset === y);
        return (
          <Box key={y} p={2.5} bg="bg.subtle" borderRadius="md" minH="64px">
            <Text fontSize="xs" color="fg.muted" mb={1.5}>
              {t("rotations.yearLabel", { year: y + 1 })}
              {rotation.start_year ? ` · ${rotation.start_year + y}` : ""}
            </Text>
            <Stack spacing={1}>
              {steps.map((s) => (
                <Flex key={s.id} align="center" gap={2}>
                  <CropChip name={s.crop_name ?? labels.stepRole("fallow")} color={s.crop_color} size="xs" />
                  {s.role !== "main" ? (
                    <Badge fontSize="9px" variant="outline" colorScheme="gray">
                      {labels.stepRole(s.role)}
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
                  {t("rotations.empty")}
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
  const { t } = useTranslation("grow");
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
      title={t("rotations.title")}
      subtitle={t("rotations.subtitle")}
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
          {t("rotations.newRotation")}
        </Button>
      }
    >
      {!rotations.length ? (
        <Card variant="surface">
          <EmptyState title={t("rotations.emptyTitle")} body={t("rotations.emptyBody")} />
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
                    {t("rotations.cycleSummary", {
                      farm: r.farm_name,
                      years: r.cycle_years,
                      count: r.fields.length,
                    })}
                  </Text>
                  {!r.is_active ? <Badge colorScheme="gray">{t("rotations.inactive")}</Badge> : null}
                  {!r.steps.length ? <Badge colorScheme="yellow">{t("rotations.noStepsYet")}</Badge> : null}
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

      <Drawer open={open} title={t("rotations.newRotation")} onClose={() => setOpen(false)}>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label={t("labels.name", { ns: "common" })} htmlFor="r-name">
            <Input id="r-name" isRequired value={name} onChange={(e) => setName(e.target.value)} placeholder={t("rotations.namePlaceholder")} />
          </FormField>
          <FormField label={t("labels.farm", { ns: "common" })} htmlFor="r-farm">
            <Select id="r-farm" value={farm} onChange={(e) => setFarm(e.target.value)} isRequired>
              <option value="">{t("rotations.selectFarm")}</option>
              {(farmsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("rotations.yearOfStepOne")} htmlFor="r-year" hint={t("rotations.yearHint")}>
            <Input id="r-year" type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)} />
          </FormField>
          <FormField label={t("labels.notes", { ns: "common" })} htmlFor="r-notes">
            <Textarea id="r-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </FormField>
          <Button type="submit" colorScheme="brand" isDisabled={create.isPending || !name || !farm}>
            {create.isPending ? t("rotations.creating") : t("rotations.createAndAddSteps")}
          </Button>
        </form>
      </Drawer>
    </ListPage>
  );
}
