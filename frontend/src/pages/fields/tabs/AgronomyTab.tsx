import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardBody,
  Heading,
  Link,
  ListItem,
  OrderedList,
  SimpleGrid,
  Text,
} from "@chakra-ui/react";
import { farmsApi, irrigationApi, sensorsApi } from "@/api/client";
import { formatDate } from "@/lib/utils";
import { EmptyState, StatusBadge } from "@/components/ui/StatCard";

export function AgronomyTab({ fieldId }: { fieldId: string }) {
  const historyQ = useQuery({
    queryKey: ["field-history", fieldId],
    queryFn: () => farmsApi.fieldHistory(fieldId),
  });
  const zonesQ = useQuery({
    queryKey: ["irrigation-zones", { field: fieldId }],
    queryFn: () => irrigationApi.zones({ field: fieldId }),
  });
  const sensorsQ = useQuery({
    queryKey: ["sensors", { field: fieldId }],
    queryFn: () => sensorsApi.list({ field: fieldId }),
  });

  const history = historyQ.data ?? [];
  const zones = zonesQ.data?.results ?? [];
  const sensors = sensorsQ.data?.results ?? [];

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
      <Card variant="surface" as="section">
        <CardBody>
          <Heading size="sm" mb={3}>
            Crop history
          </Heading>
          {history.length === 0 ? (
            <EmptyState title="No history yet" body="Prior seasons (corn, soy, wheat) will timeline here." />
          ) : (
            <OrderedList pl="18px">
              {history.map((h) => (
                <ListItem key={h.id} mb={2.5}>
                  <Text as="span" fontWeight="semibold">
                    {h.crop_name}
                  </Text>{" "}
                  · {h.season}
                  <Text color="fg.muted" fontSize="sm">
                    {formatDate(h.planted_at)} → {formatDate(h.harvested_at)} · {h.yield_amount ?? "—"} bu
                  </Text>
                </ListItem>
              ))}
            </OrderedList>
          )}
        </CardBody>
      </Card>

      <Card variant="surface" as="section">
        <CardBody>
          <Heading size="sm" mb={3}>
            Irrigation zones
          </Heading>
          {zones.length === 0 ? (
            <Text color="fg.muted">No zones on this field.</Text>
          ) : (
            zones.map((z) => (
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
            ))
          )}

          <Heading size="sm" mt={5} mb={3}>
            Sensors
          </Heading>
          {sensors.length === 0 ? (
            <Text color="fg.muted">No probes installed on this field.</Text>
          ) : (
            sensors.map((s) => (
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
            ))
          )}
        </CardBody>
      </Card>
    </SimpleGrid>
  );
}
