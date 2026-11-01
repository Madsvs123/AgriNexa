import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Input,
  Link,
  ListItem,
  OrderedList,
  Select,
  SimpleGrid,
  Spacer,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { farmsApi, getApiError, irrigationApi, sensorsApi } from "@/api/client";
import { formatAcres, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, StatCard, EmptyState } from "@/components/ui/StatCard";
import { MapView, SOIL_COLORS } from "@/components/ui/MapView";
import { Drawer } from "@/components/ui/Modal";
import { BoundaryEditor, type ContextShape } from "@/components/ui/BoundaryEditor";
import type { GeoJSONPolygon } from "@/types";

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

const PLOT_COLORS = ["#3D7EA6", "#D4A017", "#8C5A3C", "#7CB518", "#B05A7A"];

export default function FieldDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const fieldQ = useQuery({ queryKey: ["field", id], queryFn: () => farmsApi.getField(id), enabled: !!id });
  const historyQ = useQuery({ queryKey: ["field-history", id], queryFn: () => farmsApi.fieldHistory(id), enabled: !!id });
  const notesQ = useQuery({ queryKey: ["field-notes", { field: id }], queryFn: () => farmsApi.notes({ field: id }) });
  const zonesQ = useQuery({ queryKey: ["irrigation-zones", { field: id }], queryFn: () => irrigationApi.zones({ field: id }) });
  const sensorsQ = useQuery({ queryKey: ["sensors", { field: id }], queryFn: () => sensorsApi.list({ field: id }) });
  const plotsQ = useQuery({ queryKey: ["plots", { field: id }], queryFn: () => farmsApi.plots({ field: id }) });
  const [plotDrawer, setPlotDrawer] = useState(false);
  const [plotName, setPlotName] = useState("");
  const [plotBoundary, setPlotBoundary] = useState<GeoJSONPolygon | null>(null);
  const [plotError, setPlotError] = useState<string | null>(null);
  const createPlot = useMutation({
    mutationFn: () => farmsApi.createPlot({ field: id, name: plotName, boundary: plotBoundary }),
    onSuccess: () => {
      setPlotDrawer(false);
      setPlotName("");
      setPlotBoundary(null);
      setPlotError(null);
      qc.invalidateQueries({ queryKey: ["plots"] });
    },
    onError: (err) => setPlotError(getApiError(err)),
  });
  const deletePlot = useMutation({
    mutationFn: (plotId: string) => farmsApi.deletePlot(plotId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plots"] }),
  });
  const soilQ = useQuery({
    queryKey: ["soil-layers", { field: id }],
    queryFn: () => farmsApi.soilLayers({ field: id }),
  });
  const [soilDrawer, setSoilDrawer] = useState(false);
  const [soilError, setSoilError] = useState<string | null>(null);
  const [soilForm, setSoilForm] = useState({ name: "", soil_type: "loam", ph: "", organic_matter_pct: "" });
  const [soilBoundary, setSoilBoundary] = useState<GeoJSONPolygon | null>(null);
  const createSoil = useMutation({
    mutationFn: () =>
      farmsApi.createSoilLayer({
        field: id,
        name: soilForm.name,
        soil_type: soilForm.soil_type,
        ph: soilForm.ph ? Number(soilForm.ph) : null,
        organic_matter_pct: soilForm.organic_matter_pct ? Number(soilForm.organic_matter_pct) : null,
        boundary: soilBoundary,
      }),
    onSuccess: () => {
      setSoilDrawer(false);
      setSoilForm({ name: "", soil_type: "loam", ph: "", organic_matter_pct: "" });
      setSoilBoundary(null);
      setSoilError(null);
      qc.invalidateQueries({ queryKey: ["soil-layers"] });
    },
    onError: (err) => setSoilError(getApiError(err)),
  });
  const deleteSoil = useMutation({
    mutationFn: (layerId: string) => farmsApi.deleteSoilLayer(layerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["soil-layers"] }),
  });
  const elevationQ = useQuery({
    queryKey: ["field-elevation", id],
    queryFn: () => farmsApi.fieldElevation(id),
    enabled: !!id && !!fieldQ.data?.boundary,
    retry: false,
  });
  const refreshElevation = useMutation({
    mutationFn: () => farmsApi.fieldElevation(id, true),
    onSuccess: (data) => qc.setQueryData(["field-elevation", id], data),
  });
  const addNote = useMutation({
    mutationFn: () => farmsApi.createNote({ field: id, body }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["field-notes"] });
    },
  });
  const field = fieldQ.data;

  if (fieldQ.isLoading) {
    return (
      <Box>
        <SkeletonBlock rows={8} />
      </Box>
    );
  }
  if (!field) {
    return (
      <Box>
        <ErrorBanner message={fieldQ.error ? getApiError(fieldQ.error) : "Field not found."} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={field.name}
        subtitle={`${field.farm_name ?? "Farm"} · ${field.soil_type || "Soil unknown"}`}
        crumbs={
          <>
            <Link as={RouterLink} to="/fields">
              Fields
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">{field.name}</Text>
          </>
        }
        actions={
          <>
            <Button as={RouterLink} to={`/fields/${field.id}/edit`} variant="ghost" colorScheme="gray">
              Edit field
            </Button>
            <Button as={RouterLink} to={`/farms/${field.farm}`} variant="ghost" colorScheme="gray">
              Open farm
            </Button>
          </>
        }
      />
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
        <StatCard label="Acres" value={formatAcres(field.acres)} />
        <StatCard label="Crop" value={field.crop_name ?? "Fallow"} />
        <StatCard label="Moisture" value={field.moisture != null ? `${field.moisture}%` : "—"} />
        <StatCard label="Health" value={<StatusBadge status={field.health_status} />} />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <Box
          bg="bg.surface"
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="xl"
          minH="280px"
          overflow="hidden"
        >
          <MapView
            height="280px"
            fields={[field]}
            sensors={sensorsQ.data?.results ?? []}
            plots={plotsQ.data?.results ?? []}
            soilLayers={soilQ.data?.results ?? []}
            showSoil
          />
        </Box>
        <Card variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Heading size="sm" mb={2}>
              Planting window
            </Heading>
            <Text>Planted {formatDate(field.planting_date)}</Text>
            <Text>Expected harvest {formatDate(field.harvest_date)}</Text>
            <Text color="fg.muted" mt={2}>
              Update dates from the crop plan if this field is in a seasonal rotation.
            </Text>
          </CardBody>
        </Card>
      </SimpleGrid>
      <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface" mb={4}>
        <CardBody>
          <Flex align="center" mb={3}>
            <Heading size="sm">Plot subdivisions</Heading>
            <Spacer />
            <Button size="sm" colorScheme="brand" onClick={() => setPlotDrawer(true)}>
              Add plot
            </Button>
          </Flex>
          {(plotsQ.data?.results ?? []).length === 0 ? (
            <Text color="fg.muted">
              No plots yet. Subdivide this field into trial strips, management zones, or beds.
            </Text>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              {(plotsQ.data?.results ?? []).map((p, i) => (
                <Flex
                  key={p.id}
                  align="center"
                  gap={2}
                  p={3}
                  borderWidth="1px"
                  borderColor="border.default"
                  borderRadius="lg"
                >
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
                    Remove
                  </Button>
                </Flex>
              ))}
            </SimpleGrid>
          )}
        </CardBody>
      </Card>
      <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface" mb={4}>
        <CardBody>
          <Flex align="center" mb={3}>
            <Heading size="sm">Soil &amp; elevation</Heading>
            <Spacer />
            <Button size="sm" variant="ghost" colorScheme="gray" onClick={() => setSoilDrawer(true)}>
              Add soil layer
            </Button>
          </Flex>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Box>
              {(soilQ.data?.results ?? []).length === 0 ? (
                <Text color="fg.muted">No soil layers mapped. Draw zones for clay knobs, sandy ridges, or peat pockets.</Text>
              ) : (
                (soilQ.data?.results ?? []).map((s) => (
                  <Flex key={s.id} align="center" gap={2} mb={2}>
                    <Box boxSize={3} borderRadius="sm" bg={SOIL_COLORS[s.soil_type] ?? "#B98A2F"} />
                    <Text fontWeight="semibold">{s.name}</Text>
                    <Text color="fg.muted">
                      {s.soil_type_display ?? s.soil_type} · {formatAcres(Number(s.acres))}
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
                      Remove
                    </Button>
                  </Flex>
                ))
              )}
            </Box>
            <Box>
              {!field.boundary ? (
                <Text color="fg.muted">Draw a field boundary to estimate elevation.</Text>
              ) : elevationQ.isLoading ? (
                <Text color="fg.muted">Estimating elevation…</Text>
              ) : elevationQ.data ? (
                <Box>
                  <SimpleGrid columns={3} spacing={3} mb={2}>
                    <StatCard label="Min" value={`${formatNumber(elevationQ.data.min_m)} m`} />
                    <StatCard label="Mean" value={`${formatNumber(elevationQ.data.mean_m)} m`} />
                    <StatCard label="Max" value={`${formatNumber(elevationQ.data.max_m)} m`} />
                  </SimpleGrid>
                  <Flex align="center" gap={2}>
                    <Text fontSize="sm" color="fg.muted">
                      Relief {formatNumber(elevationQ.data.relief_m)} m ·{" "}
                      {elevationQ.data.source === "open-meteo" ? "Open-Meteo terrain" : "offline estimate"} ·{" "}
                      {elevationQ.data.points.length} sample points
                    </Text>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="gray"
                      isDisabled={refreshElevation.isPending}
                      onClick={() => refreshElevation.mutate()}
                    >
                      {refreshElevation.isPending ? "Refreshing…" : "Refresh"}
                    </Button>
                  </Flex>
                </Box>
              ) : (
                <Text color="fg.muted">Elevation unavailable for this boundary.</Text>
              )}
            </Box>
          </SimpleGrid>
        </CardBody>
      </Card>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Heading size="sm" mb={3}>
              Crop history
            </Heading>
            {(historyQ.data ?? []).length === 0 ? (
              <EmptyState title="No history yet" body="Prior seasons (corn, soy, wheat) will timeline here." />
            ) : (
              <OrderedList pl="18px">
                {(historyQ.data ?? []).map((h) => (
                  <ListItem key={h.id} mb={2.5}>
                    <Text as="span" fontWeight="semibold">
                      {h.crop_name}
                    </Text>{" "}
                    · {h.season}
                    <Text color="fg.muted">
                      {formatDate(h.planted_at)} → {formatDate(h.harvested_at)} · {h.yield_amount ?? "—"} bu
                    </Text>
                  </ListItem>
                ))}
              </OrderedList>
            )}
          </CardBody>
        </Card>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Heading size="sm" mb={3}>
              Irrigation zones
            </Heading>
            {(zonesQ.data?.results ?? []).map((z) => (
              <Link
                as={RouterLink}
                key={z.id}
                to={`/irrigation/zones/${z.id}`}
                display="flex"
                alignItems="center"
                gap={2}
                mb={2}
              >
                <StatusBadge status={z.status} />
                {z.name} · threshold {z.threshold}%
              </Link>
            ))}
            {!zonesQ.data?.results.length ? <Text color="fg.muted">No zones on this field.</Text> : null}
            <Heading size="sm" mt={4} mb={3}>
              Sensors
            </Heading>
            {(sensorsQ.data?.results ?? []).map((s) => (
              <Link
                as={RouterLink}
                key={s.id}
                to={`/sensors/${s.id}`}
                display="flex"
                alignItems="center"
                gap={2}
                mb={2}
              >
                <StatusBadge status={s.status} />
                {s.name}
              </Link>
            ))}
          </CardBody>
        </Card>
      </SimpleGrid>
      <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface" mt={4}>
        <CardBody>
          <Heading size="sm" mb={3}>
            Notes
          </Heading>
          <FormField label="Add a note" htmlFor="fnote">
            <Textarea
              id="fnote"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Residue heavy on the east headland…"
            />
          </FormField>
          <Button colorScheme="brand" isDisabled={!body || addNote.isPending} onClick={() => addNote.mutate()}>
            Post note
          </Button>
          {(notesQ.data?.results ?? []).map((n) => (
            <Box key={n.id} mt={3}>
              <Text color="fg.muted">
                {n.author_name} · {formatDateTime(n.created_at)}
              </Text>
              <Text>{n.body}</Text>
            </Box>
          ))}
        </CardBody>
      </Card>
      <Drawer open={plotDrawer} title="Add plot" onClose={() => setPlotDrawer(false)} wide>
        <ErrorBanner message={plotError} />
        <FormField label="Plot name" htmlFor="plot-name" hint="e.g. Strip A, Trial block 3">
          <Input id="plot-name" value={plotName} onChange={(e) => setPlotName(e.target.value)} />
        </FormField>
        <FormField
          label="Plot boundary"
          htmlFor="plot-boundary"
          hint="Draw inside the dashed field outline. Plots may not overlap each other."
        >
          <BoundaryEditor
            value={plotBoundary}
            onChange={setPlotBoundary}
            context={[
              ...(field.boundary
                ? [{ polygon: field.boundary, color: "#2F6F4E", label: field.name } satisfies ContextShape]
                : []),
              ...((plotsQ.data?.results ?? [])
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
          isDisabled={!plotName || !plotBoundary || createPlot.isPending}
          onClick={() => createPlot.mutate()}
        >
          {createPlot.isPending ? "Saving…" : "Save plot"}
        </Button>
      </Drawer>
      <Drawer open={soilDrawer} title="Add soil layer" onClose={() => setSoilDrawer(false)} wide>
        <ErrorBanner message={soilError} />
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label="Name" htmlFor="soil-name" hint="e.g. Sandy ridge, Clay bottom">
            <Input
              id="soil-name"
              value={soilForm.name}
              onChange={(e) => setSoilForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="Soil type" htmlFor="soil-type">
            <Select
              id="soil-type"
              value={soilForm.soil_type}
              onChange={(e) => setSoilForm((f) => ({ ...f, soil_type: e.target.value }))}
            >
              {SOIL_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label="pH" htmlFor="soil-ph">
            <Input
              id="soil-ph"
              type="number"
              step="0.1"
              min="0"
              max="14"
              value={soilForm.ph}
              onChange={(e) => setSoilForm((f) => ({ ...f, ph: e.target.value }))}
            />
          </FormField>
          <FormField label="Organic matter %" htmlFor="soil-om">
            <Input
              id="soil-om"
              type="number"
              step="0.1"
              min="0"
              value={soilForm.organic_matter_pct}
              onChange={(e) => setSoilForm((f) => ({ ...f, organic_matter_pct: e.target.value }))}
            />
          </FormField>
        </SimpleGrid>
        <FormField label="Layer boundary" htmlFor="soil-boundary" hint="Draw inside the dashed field outline.">
          <BoundaryEditor
            value={soilBoundary}
            onChange={setSoilBoundary}
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
          isDisabled={!soilForm.name || !soilBoundary || createSoil.isPending}
          onClick={() => createSoil.mutate()}
        >
          {createSoil.isPending ? "Saving…" : "Save soil layer"}
        </Button>
      </Drawer>
    </Box>
  );
}
