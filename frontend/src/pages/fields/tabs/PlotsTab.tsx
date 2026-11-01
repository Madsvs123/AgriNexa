import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardBody, Flex, Input, SimpleGrid, Spacer, Text } from "@chakra-ui/react";
import { farmsApi, getApiError } from "@/api/client";
import { formatAcres } from "@/lib/utils";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { EmptyState } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";
import { BoundaryEditor, type ContextShape } from "@/components/ui/BoundaryEditor";
import type { Field, GeoJSONPolygon } from "@/types";
import { useTranslation } from "react-i18next";

export const PLOT_COLORS = ["#3D7EA6", "#D4A017", "#8C5A3C", "#7CB518", "#B05A7A"];

export function PlotsTab({ field }: { field: Field }) {
  const id = field.id;
  const qc = useQueryClient();
  const { t } = useTranslation("land");
  const plotsQ = useQuery({ queryKey: ["plots", { field: id }], queryFn: () => farmsApi.plots({ field: id }) });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [boundary, setBoundary] = useState<GeoJSONPolygon | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createPlot = useMutation({
    mutationFn: () => farmsApi.createPlot({ field: id, name, boundary }),
    onSuccess: () => {
      setOpen(false);
      setName("");
      setBoundary(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ["plots"] });
    },
    onError: (err) => setError(getApiError(err)),
  });
  const deletePlot = useMutation({
    mutationFn: (plotId: string) => farmsApi.deletePlot(plotId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plots"] }),
  });

  const plots = plotsQ.data?.results ?? [];

  return (
    <Box>
      <Flex align="center" mb={3}>
        <Text color="fg.muted">{t("plotsTab.intro")}</Text>
        <Spacer />
        <Button size="sm" colorScheme="brand" onClick={() => setOpen(true)}>
          {t("plotsTab.addPlot")}
        </Button>
      </Flex>

      {plots.length === 0 ? (
        <Card variant="surface">
          <EmptyState
            title={t("plotsTab.emptyTitle")}
            body={t("plotsTab.emptyBody")}
            action={
              <Button size="sm" colorScheme="brand" onClick={() => setOpen(true)}>
                Add plot
              </Button>
            }
          />
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          {plots.map((p, i) => (
            <Card key={p.id} variant="surface">
              <CardBody py={3}>
                <Flex align="center" gap={2}>
                  <Box boxSize={3} borderRadius="sm" bg={PLOT_COLORS[i % PLOT_COLORS.length]} />
                  <Text fontWeight="semibold">{p.name}</Text>
                  <Text color="fg.muted">{formatAcres(p.acres)}</Text>
                  <Spacer />
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="red"
                    isDisabled={deletePlot.isPending}
                    onClick={() => deletePlot.mutate(p.id)}
                  >
                    {t("actions.remove", { ns: "common" })}
                  </Button>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Drawer open={open} title={t("plotsTab.addPlot")} onClose={() => setOpen(false)} wide>
        <ErrorBanner message={error} />
        <FormField label={t("plotsTab.plotName")} htmlFor="plot-name" hint={t("plotsTab.plotNameHint")}>
          <Input id="plot-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField
          label={t("plotsTab.plotBoundary")}
          htmlFor="plot-boundary"
          hint={t("plotsTab.plotBoundaryHint")}
        >
          <BoundaryEditor
            value={boundary}
            onChange={setBoundary}
            context={[
              ...(field.boundary
                ? [{ polygon: field.boundary, color: "#2F6F4E", label: field.name } satisfies ContextShape]
                : []),
              ...(plots
                .filter((p) => p.boundary)
                .map((p, i) => ({
                  polygon: p.boundary as GeoJSONPolygon,
                  color: PLOT_COLORS[i % PLOT_COLORS.length],
                  label: p.name,
                })) satisfies ContextShape[]),
            ]}
            center={
              field.centroid_lat != null && field.centroid_lng != null
                ? [Number(field.centroid_lat), Number(field.centroid_lng)]
                : undefined
            }
          />
        </FormField>
        <Button
          colorScheme="brand"
          isDisabled={!name || !boundary || createPlot.isPending}
          onClick={() => createPlot.mutate()}
        >
          {createPlot.isPending ? t("actions.saving", { ns: "common" }) : t("plotsTab.savePlot")}
        </Button>
      </Drawer>
    </Box>
  );
}
