import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Flex, Input, Select, SimpleGrid, Text } from "@chakra-ui/react";
import { farmsApi, getApiError } from "@/api/client";
import { formatAcres, formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { MapView } from "@/components/ui/MapView";

export default function FarmsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const farmsQ = useQuery({ queryKey: ["farms", q, region], queryFn: () => farmsApi.list({ search: q || undefined, region: region || undefined }) });
  const regionsQ = useQuery({ queryKey: ["regions"], queryFn: () => farmsApi.regions() });
  const fieldsQ = useQuery({ queryKey: ["fields"], queryFn: () => farmsApi.fields() });
  const farms = farmsQ.data?.results ?? [];

  return (
    <Box>
      <PageHeader
        title="Farms"
        subtitle="Every operated unit — codes, acres, and map position."
        actions={
          <Button as={RouterLink} to="/farms/new" colorScheme="brand">
            Add farm
          </Button>
        }
      />
      <ErrorBanner message={farmsQ.error ? getApiError(farmsQ.error) : null} />
      <Flex gap={3} wrap="wrap" mb={4}>
        <Input
          maxW="320px"
          placeholder="Search North Ridge, WR-02…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search farms"
        />
        <Select maxW="220px" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Filter by region">
          <option value="">All regions</option>
          {(regionsQ.data?.results ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box>
          {farmsQ.isLoading ? (
            <SkeletonBlock />
          ) : (
            <DataTable
              rows={farms}
              rowKey={(f) => f.id}
              onRowClick={(f) => navigate(`/farms/${f.id}`)}
              emptyTitle="No farms yet"
              emptyBody="Create North Ridge or Willow Creek to start mapping fields and sensors."
              emptyAction={
                <Button as={RouterLink} to="/farms/new" colorScheme="brand">
                  Add farm
                </Button>
              }
              columns={[
                {
                  key: "name",
                  header: "Farm",
                  render: (f) => (
                    <Text as="span" fontWeight="semibold">
                      {f.name}
                    </Text>
                  ),
                },
                { key: "code", header: "Code" },
                { key: "total_acres", header: "Acres", render: (f) => formatAcres(f.total_acres) },
                { key: "field_count", header: "Fields", render: (f) => formatNumber(f.field_count) },
                { key: "address", header: "Address", render: (f) => f.address || "—" },
              ]}
            />
          )}
        </Box>
        <Box bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl" minH="360px" overflow="hidden">
          <MapView
            height="420px"
            fields={fieldsQ.data?.results ?? []}
            center={farms[0]?.lat && farms[0]?.lng ? [farms[0].lat, farms[0].lng] : undefined}
          />
        </Box>
      </SimpleGrid>
    </Box>
  );
}
