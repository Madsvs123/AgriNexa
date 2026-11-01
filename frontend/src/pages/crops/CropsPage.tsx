import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardBody, Heading, Input, Select, SimpleGrid, Text } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Modal";

export default function CropsPage() {
  const qc = useQueryClient();
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const plansQ = useQuery({ queryKey: ["crop-plans"], queryFn: () => cropsApi.plans() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "grain", typical_days_to_harvest: "120", water_needs: "medium" });
  const create = useMutation({
    mutationFn: () =>
      cropsApi.createCrop({
        ...form,
        typical_days_to_harvest: Number(form.typical_days_to_harvest),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      setOpen(false);
    },
  });

  return (
    <Box>
      <PageHeader
        title="Crop catalog"
        subtitle="Species grown across the organization this season."
        actions={
          <>
            <Button as={RouterLink} to="/crops/plans" variant="ghost" colorScheme="gray">
              Seasonal plans
            </Button>
            <Button colorScheme="brand" onClick={() => setOpen(true)}>
              Add crop
            </Button>
          </>
        }
      />
      <ErrorBanner message={cropsQ.error ? getApiError(cropsQ.error) : null} />
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={4}>
        <Card
          as={RouterLink}
          to="/crops/varieties"
          variant="outline"
          borderColor="border.default"
          bg="bg.surface"
          _hover={{ borderColor: "brand.300" }}
        >
          <CardBody>
            <Heading size="sm" mb={1}>
              Varieties
            </Heading>
            <Text color="fg.muted">Hybrids and traits — P1197, AG27XF3, and more.</Text>
          </CardBody>
        </Card>
        <Card
          as={RouterLink}
          to="/crops/rotations"
          variant="outline"
          borderColor="border.default"
          bg="bg.surface"
          _hover={{ borderColor: "brand.300" }}
        >
          <CardBody>
            <Heading size="sm" mb={1}>
              Rotations
            </Heading>
            <Text color="fg.muted">Corn–soy–wheat sequences by field.</Text>
          </CardBody>
        </Card>
        <Card
          as={RouterLink}
          to="/crops/budget"
          variant="outline"
          borderColor="border.default"
          bg="bg.surface"
          _hover={{ borderColor: "brand.300" }}
        >
          <CardBody>
            <Heading size="sm" mb={1}>
              Budget
            </Heading>
            <Text color="fg.muted">Planned vs actual seed, chem, and fertilizer.</Text>
          </CardBody>
        </Card>
      </SimpleGrid>
      <DataTable
        rows={cropsQ.data?.results ?? []}
        rowKey={(c) => c.id}
        emptyTitle="No crops in the catalog"
        emptyBody="Add corn, soybean, or wheat to start seasonal plans."
        columns={[
          { key: "name", header: "Crop" },
          { key: "category", header: "Category" },
          { key: "typical_days_to_harvest", header: "Days to harvest" },
          { key: "water_needs", header: "Water needs" },
        ]}
      />
      <Text color="fg.muted" mt={3}>
        {plansQ.data?.count ?? 0} active crop plans this season.
      </Text>
      <Drawer open={open} title="Add crop" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Name" htmlFor="cname">
            <Input id="cname" isRequired value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Category" htmlFor="ccat">
            <Select id="ccat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="grain">Grain</option>
              <option value="oilseed">Oilseed</option>
              <option value="forage">Forage</option>
              <option value="specialty">Specialty</option>
            </Select>
          </FormField>
          <FormField label="Days to harvest" htmlFor="cdays">
            <Input
              id="cdays"
              type="number"
              value={form.typical_days_to_harvest}
              onChange={(e) => setForm({ ...form, typical_days_to_harvest: e.target.value })}
            />
          </FormField>
          <FormField label="Water needs" htmlFor="cwater">
            <Select id="cwater" value={form.water_needs} onChange={(e) => setForm({ ...form, water_needs: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </FormField>
          <Button type="submit" colorScheme="brand" isDisabled={create.isPending}>
            Save crop
          </Button>
        </form>
      </Drawer>
    </Box>
  );
}
