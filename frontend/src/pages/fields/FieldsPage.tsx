import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Flex, Input, Select, Text } from "@chakra-ui/react";
import { farmsApi, getApiError } from "@/api/client";
import { formatAcres } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";

export default function FieldsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [soil, setSoil] = useState("");
  const fieldsQ = useQuery({
    queryKey: ["fields", q, soil],
    queryFn: () => farmsApi.fields({ search: q || undefined, soil_type: soil || undefined }),
  });

  return (
    <Box>
      <PageHeader
        title="Fields"
        subtitle="Soil, crop, acres, and moisture for every managed boundary."
        actions={
          <Button as={RouterLink} to="/fields/new" colorScheme="brand">
            Add field
          </Button>
        }
      />
      <ErrorBanner message={fieldsQ.error ? getApiError(fieldsQ.error) : null} />
      <Flex gap={3} wrap="wrap" mb={4}>
        <Input
          maxW="320px"
          placeholder="Search South Bottom, NR-12…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search fields"
        />
        <Select maxW="220px" value={soil} onChange={(e) => setSoil(e.target.value)} aria-label="Soil type">
          <option value="">All soils</option>
          <option value="loam">Loam</option>
          <option value="clay_loam">Clay loam</option>
          <option value="sandy_loam">Sandy loam</option>
          <option value="silt_loam">Silt loam</option>
        </Select>
      </Flex>
      <Box>
        {fieldsQ.isLoading ? (
          <SkeletonBlock />
        ) : (
          <DataTable
            rows={fieldsQ.data?.results ?? []}
            rowKey={(f) => f.id}
            onRowClick={(f) => navigate(`/fields/${f.id}`)}
            emptyTitle="No fields mapped"
            emptyBody="Draw a boundary on North 80 or import a shapefile via the field form."
            columns={[
              {
                key: "name",
                header: "Field",
                render: (f) => (
                  <Text as="span" fontWeight="semibold">
                    {f.name}
                  </Text>
                ),
              },
              { key: "farm_name", header: "Farm", render: (f) => f.farm_name ?? "—" },
              { key: "soil_type", header: "Soil", render: (f) => f.soil_type || "—" },
              { key: "crop_name", header: "Crop", render: (f) => f.crop_name ?? "Fallow" },
              { key: "acres", header: "Acres", render: (f) => formatAcres(f.acres) },
              {
                key: "moisture",
                header: "Moisture",
                render: (f) => (f.moisture != null ? `${f.moisture}%` : "—"),
              },
              { key: "health_status", header: "Health", render: (f) => <StatusBadge status={f.health_status} /> },
            ]}
          />
        )}
      </Box>
    </Box>
  );
}
