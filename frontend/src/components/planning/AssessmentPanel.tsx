import { Alert, AlertIcon, Badge, Box, Flex, SimpleGrid, Skeleton, Stack, Text } from "@chakra-ui/react";
import type { PlantingAssessment } from "@/types";
import { formatDate } from "@/lib/utils";
import { fitLabel, fitScheme } from "@/lib/planning";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="semibold">
        {value}
      </Text>
    </Box>
  );
}

/** Planting-window, harvest, rotation, and conflict read-out for one planting. */
export function AssessmentPanel({
  data,
  loading,
  compact,
}: {
  data: PlantingAssessment | undefined;
  loading?: boolean;
  compact?: boolean;
}) {
  if (loading && !data) {
    return (
      <Stack spacing={2}>
        <Skeleton h="18px" w="40%" />
        <Skeleton h="14px" />
        <Skeleton h="14px" w="80%" />
      </Stack>
    );
  }
  if (!data) {
    return (
      <Text color="fg.muted" fontSize="sm">
        Pick a field, crop, and planting date to see how it fits the window.
      </Text>
    );
  }
  const w = data.window;
  return (
    <Stack spacing={3}>
      <Flex align="center" gap={2} wrap="wrap">
        <Badge colorScheme={fitScheme(data.fit)} fontSize="xs" px={2} py={0.5} borderRadius="md">
          {fitLabel(data.fit)}
        </Badge>
        {data.harvest_ok === false ? (
          <Badge colorScheme="red" variant="outline">
            Misses harvest-by
          </Badge>
        ) : data.harvest_ok ? (
          <Badge colorScheme="green" variant="outline">
            Harvest in time
          </Badge>
        ) : null}
        {data.soil_match === false ? (
          <Badge colorScheme="orange" variant="outline">
            Soil mismatch
          </Badge>
        ) : null}
        <Badge
          colorScheme={data.rotation.score >= 80 ? "green" : data.rotation.score >= 60 ? "yellow" : "red"}
          variant="subtle"
        >
          Rotation {data.rotation.score}
        </Badge>
      </Flex>

      <SimpleGrid columns={compact ? 2 : { base: 2, md: 4 }} spacing={3}>
        <Fact label="Window" value={w.start ? `${formatDate(w.start)} – ${formatDate(w.end)}` : "—"} />
        <Fact label="Late until" value={formatDate(w.late_end)} />
        <Fact label="Harvest by" value={formatDate(w.harvest_by)} />
        <Fact
          label="Projected harvest"
          value={data.projected_harvest ? `${formatDate(data.projected_harvest)} · ${data.days_to_maturity}d` : "—"}
        />
      </SimpleGrid>

      {!w.defined ? (
        <Text fontSize="xs" color="fg.muted">
          Using the category default window — add a planting window for this crop to refine it.
        </Text>
      ) : w.source ? (
        <Text fontSize="xs" color="fg.muted">
          Window source: {w.source}
        </Text>
      ) : null}

      {data.rotation.lineage.length ? (
        <Text fontSize="sm" color="fg.muted">
          Field history:{" "}
          {data.rotation.lineage.map((l) => `${l.name}${l.year ? ` (${l.year})` : ""}`).join(" ← ")}
        </Text>
      ) : null}

      {data.rotation.notes.map((n) => (
        <Alert key={n} status="success" variant="left-accent" borderRadius="md" py={2} fontSize="sm">
          <AlertIcon boxSize={4} />
          {n}
        </Alert>
      ))}
      {data.conflicts.map((c) => (
        <Alert key={c.plan_id} status="error" variant="left-accent" borderRadius="md" py={2} fontSize="sm">
          <AlertIcon boxSize={4} />
          {c.message}
        </Alert>
      ))}
      {data.warnings
        .filter((wn) => !data.conflicts.some((c) => c.message === wn))
        .map((wn) => (
          <Alert key={wn} status="warning" variant="left-accent" borderRadius="md" py={2} fontSize="sm">
            <AlertIcon boxSize={4} />
            {wn}
          </Alert>
        ))}
      {!data.warnings.length && !data.conflicts.length ? (
        <Alert status="success" variant="left-accent" borderRadius="md" py={2} fontSize="sm">
          <AlertIcon boxSize={4} />
          No issues found for this planting.
        </Alert>
      ) : null}
    </Stack>
  );
}
