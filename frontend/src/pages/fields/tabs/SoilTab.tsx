import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Input,
  Select,
  SimpleGrid,
  Spacer,
  Text,
} from "@chakra-ui/react";
import { farmsApi, getApiError } from "@/api/client";
import { formatAcres, formatNumber } from "@/lib/utils";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { StatCard } from "@/components/ui/StatCard";
import { SOIL_COLORS } from "@/components/ui/MapView";
import { Drawer } from "@/components/ui/Modal";
import { BoundaryEditor, type ContextShape } from "@/components/ui/BoundaryEditor";
import type { Field, GeoJSONPolygon } from "@/types";
import { useTranslation } from "react-i18next";
import { usePlanningLabels } from "@/lib/usePlanningLabels";

const SOIL_TYPES = [
  ["clay", "Clay"],
  ["clay_loam", "Clay loam"],
  ["loam", "Loam"],
  ["silt_loam", "Silt loam"],
  ["silt", "Silt"],
  ["sandy_loam", "Sandy loam"],
  ["sand", "Sand"],
  ["peat", "Peat"],
  ["chalk", "Chalk"],
] as const;

export function SoilTab({ field }: { field: Field }) {
  const id = field.id;
  const qc = useQueryClient();
  const { t } = useTranslation("land");
  const labels = usePlanningLabels();

  const soilQ = useQuery({
    queryKey: ["soil-layers", { field: id }],
    queryFn: () => farmsApi.soilLayers({ field: id }),
  });
  const elevationQ = useQuery({
    queryKey: ["field-elevation", id],
    queryFn: () => farmsApi.fieldElevation(id),
    enabled: !!id && !!field.boundary,
    retry: false,
  });
  const refreshElevation = useMutation({
    mutationFn: () => farmsApi.fieldElevation(id, true),
    onSuccess: (data) => qc.setQueryData(["field-elevation", id], data),
  });

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", soil_type: "loam", ph: "", organic_matter_pct: "" });
  const [boundary, setBoundary] = useState<GeoJSONPolygon | null>(null);

  const createSoil = useMutation({
    mutationFn: () =>
      farmsApi.createSoilLayer({
        field: id,
        name: form.name,
        soil_type: form.soil_type,
        ph: form.ph ? Number(form.ph) : null,
        organic_matter_pct: form.organic_matter_pct ? Number(form.organic_matter_pct) : null,
        boundary,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: "", soil_type: "loam", ph: "", organic_matter_pct: "" });
      setBoundary(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ["soil-layers"] });
    },
    onError: (err) => setError(getApiError(err)),
  });
  const deleteSoil = useMutation({
    mutationFn: (layerId: string) => farmsApi.deleteSoilLayer(layerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["soil-layers"] }),
  });

  const layers = soilQ.data?.results ?? [];

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
      <Card variant="surface" as="section">
        <CardBody>
          <Flex align="center" mb={3}>
            <Heading size="sm">{t("soilTab.soilLayers")}</Heading>
            <Spacer />
            <Button size="sm" variant="ghost" colorScheme="gray" onClick={() => setOpen(true)}>
              {t("soilTab.addLayer")}
            </Button>
          </Flex>
          {layers.length === 0 ? (
            <Text color="fg.muted">
              {t("soilTab.noLayers")}
            </Text>
          ) : (
            layers.map((s) => (
              <Flex key={s.id} align="center" gap={2} mb={2}>
                <Box boxSize={3} borderRadius="sm" bg={SOIL_COLORS[s.soil_type] ?? "#B98A2F"} />
                <Text fontWeight="semibold">{s.name}</Text>
                <Text color="fg.muted" fontSize="sm">
                  {s.soil_type_display ?? labels.soil(s.soil_type)} · {formatAcres(Number(s.acres))}
                  {s.ph != null ? ` · pH ${s.ph}` : ""}
                </Text>
                <Spacer />
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  isDisabled={deleteSoil.isPending}
                  onClick={() => deleteSoil.mutate(s.id)}
                >
                  {t("actions.remove", { ns: "common" })}
                </Button>
              </Flex>
            ))
          )}
        </CardBody>
      </Card>

      <Card variant="surface" as="section">
        <CardBody>
          <Heading size="sm" mb={3}>
            {t("soilTab.elevation")}
          </Heading>
          {!field.boundary ? (
            <Text color="fg.muted">{t("soilTab.drawBoundaryFirst")}</Text>
          ) : elevationQ.isLoading ? (
            <Text color="fg.muted">{t("soilTab.estimating")}</Text>
          ) : elevationQ.data ? (
            <Box>
              <SimpleGrid columns={3} spacing={3} mb={3}>
                <StatCard label={t("soilTab.min")} value={`${formatNumber(elevationQ.data.min_m)} m`} />
                <StatCard label={t("soilTab.mean")} value={`${formatNumber(elevationQ.data.mean_m)} m`} />
                <StatCard label={t("soilTab.max")} value={`${formatNumber(elevationQ.data.max_m)} m`} />
              </SimpleGrid>
              <Flex align="center" gap={2} wrap="wrap">
                <Text fontSize="sm" color="fg.muted">
                  {t("soilTab.relief", {
                    relief: formatNumber(elevationQ.data.relief_m),
                    source:
                      elevationQ.data.source === "open-meteo"
                        ? t("soilTab.sourceOpenMeteo")
                        : t("soilTab.sourceOffline"),
                    points: elevationQ.data.points.length,
                  })}
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="gray"
                  isDisabled={refreshElevation.isPending}
                  onClick={() => refreshElevation.mutate()}
                >
                  {refreshElevation.isPending ? t("actions.refresh", { ns: "common" }) + "…" : t("actions.refresh", { ns: "common" })}
                </Button>
              </Flex>
            </Box>
          ) : (
            <Text color="fg.muted">{t("soilTab.unavailable")}</Text>
          )}
        </CardBody>
      </Card>

      <Drawer open={open} title={t("soilTab.addSoilLayer")} onClose={() => setOpen(false)} wide>
        <ErrorBanner message={error} />
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label={t("labels.name", { ns: "common" })} htmlFor="soil-name" hint={t("soilTab.layerNameHint")}>
            <Input
              id="soil-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label={t("fields.soilType")} htmlFor="soil-type">
            <Select
              id="soil-type"
              value={form.soil_type}
              onChange={(e) => setForm((f) => ({ ...f, soil_type: e.target.value }))}
            >
              {SOIL_TYPES.map(([value]) => (
                <option key={value} value={value}>
                  {labels.soil(value)}
                </option>
              ))}
            </Select>
          </FormField>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label={t("soilTab.ph")} htmlFor="soil-ph">
            <Input
              id="soil-ph"
              type="number"
              step="0.1"
              min="0"
              max="14"
              value={form.ph}
              onChange={(e) => setForm((f) => ({ ...f, ph: e.target.value }))}
            />
          </FormField>
          <FormField label={t("soilTab.organicMatter")} htmlFor="soil-om">
            <Input
              id="soil-om"
              type="number"
              step="0.1"
              min="0"
              value={form.organic_matter_pct}
              onChange={(e) => setForm((f) => ({ ...f, organic_matter_pct: e.target.value }))}
            />
          </FormField>
        </SimpleGrid>
        <FormField label={t("soilTab.layerBoundary")} htmlFor="soil-boundary" hint={t("soilTab.drawInside")}>
          <BoundaryEditor
            value={boundary}
            onChange={setBoundary}
            context={
              field.boundary
                ? [{ polygon: field.boundary, color: "#2F6F4E", label: field.name } satisfies ContextShape]
                : []
            }
            center={
              field.centroid_lat != null && field.centroid_lng != null
                ? [Number(field.centroid_lat), Number(field.centroid_lng)]
                : undefined
            }
          />
        </FormField>
        <Button
          colorScheme="brand"
          isDisabled={!form.name || !boundary || createSoil.isPending}
          onClick={() => createSoil.mutate()}
        >
          {createSoil.isPending ? t("actions.saving", { ns: "common" }) : t("soilTab.saveLayer")}
        </Button>
      </Drawer>
    </SimpleGrid>
  );
}
