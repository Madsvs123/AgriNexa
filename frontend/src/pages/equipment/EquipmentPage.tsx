import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Card, CardBody, Flex, SimpleGrid, Spacer, Text } from "@chakra-ui/react";
import { equipmentApi, getApiError } from "@/api/client";
import { formatNumber, formatPct } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { StatusBadge, EmptyState } from "@/components/ui/StatCard";

export default function EquipmentPage() {
  const listQ = useQuery({ queryKey: ["equipment"], queryFn: () => equipmentApi.list() });
  return (
    <Box>
      <PageHeader title="Equipment" subtitle="Fleet hours, fuel, and readiness." />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      {(listQ.data?.results ?? []).length === 0 ? (
        <Card variant="outline" borderColor="border.default" bg="bg.surface">
          <EmptyState title="No machines yet" body="Add Planter 12, the 8R, or the tender truck to track hours and fuel." />
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {(listQ.data?.results ?? []).map((e) => (
            <Card
              key={e.id}
              as={RouterLink}
              to={`/equipment/${e.id}`}
              variant="outline"
              borderColor="border.default"
              bg="bg.surface"
              _hover={{ borderColor: "brand.300", textDecoration: "none" }}
            >
              <CardBody>
                <Flex align="center" gap={2}>
                  <Text as="strong">{e.name}</Text>
                  <Spacer />
                  <StatusBadge status={e.status} />
                </Flex>
                <Text color="fg.muted">
                  {e.year ?? ""} {e.make} {e.model} · {e.farm_name}
                </Text>
                <Text>{formatNumber(e.hours)} hours</Text>
                <Text>Fuel {formatPct(e.fuel_level)}</Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
