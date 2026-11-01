import { useEffect, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Input, Link, Select, SimpleGrid, Text, Textarea } from "@chakra-ui/react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";

export default function FieldFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const fieldQ = useQuery({ queryKey: ["field", id], queryFn: () => farmsApi.getField(id!), enabled: isEdit });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    farm: "",
    acres: "",
    soil_type: "loam",
    crop: "",
    planting_date: "",
    harvest_date: "",
    boundary_text: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  useEffect(() => {
    if (!fieldQ.data) return;
    const field = fieldQ.data;
    setForm({
      name: field.name,
      farm: field.farm,
      acres: String(field.acres ?? ""),
      soil_type: field.soil_type || "loam",
      crop: "",
      planting_date: field.planting_date ?? "",
      harvest_date: field.harvest_date ?? "",
      boundary_text: field.boundary ? JSON.stringify(field.boundary, null, 2) : "",
    });
  }, [fieldQ.data]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    let boundary = null;
    if (form.boundary_text.trim()) {
      try {
        boundary = JSON.parse(form.boundary_text);
      } catch {
        setError("Boundary must be valid GeoJSON Polygon JSON.");
        setPending(false);
        return;
      }
    }
    const payload = {
      name: form.name,
      farm: form.farm,
      acres: Number(form.acres),
      soil_type: form.soil_type,
      crop: form.crop || null,
      planting_date: form.planting_date || null,
      harvest_date: form.harvest_date || null,
      boundary,
    };
    try {
      const saved = isEdit ? await farmsApi.patchField(id!, payload) : await farmsApi.createField(payload);
      navigate(`/fields/${saved.id}`);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title={isEdit ? "Edit field" : "New field"}
        subtitle="Name the boundary the way operators call it on the radio."
        crumbs={
          <>
            <Link as={RouterLink} to="/fields">
              Fields
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">{isEdit ? "Edit" : "New"}</Text>
          </>
        }
      />
      <ErrorBanner message={error} />
      <Box
        as="form"
        onSubmit={onSubmit}
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.default"
        borderRadius="xl"
        p={5}
        maxW="720px"
      >
        <FormField label="Field name" htmlFor="fname" hint="e.g. South Bottom">
          <Input id="fname" isRequired value={form.name} onChange={set("name")} />
        </FormField>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label="Farm" htmlFor="farm">
            <Select id="farm" isRequired value={form.farm} onChange={set("farm")}>
              <option value="">Select farm</option>
              {(farmsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Acres" htmlFor="facres">
            <Input id="facres" type="number" step="0.1" isRequired value={form.acres} onChange={set("acres")} />
          </FormField>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label="Soil type" htmlFor="soil">
            <Select id="soil" value={form.soil_type} onChange={set("soil_type")}>
              <option value="loam">Loam</option>
              <option value="clay_loam">Clay loam</option>
              <option value="sandy_loam">Sandy loam</option>
              <option value="silt_loam">Silt loam</option>
            </Select>
          </FormField>
          <FormField label="Current crop" htmlFor="crop">
            <Select id="crop" value={form.crop} onChange={set("crop")}>
              <option value="">Fallow</option>
              {(cropsQ.data?.results ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label="Planting date" htmlFor="pdate">
            <Input id="pdate" type="date" value={form.planting_date} onChange={set("planting_date")} />
          </FormField>
          <FormField label="Harvest date" htmlFor="hdate">
            <Input id="hdate" type="date" value={form.harvest_date} onChange={set("harvest_date")} />
          </FormField>
        </SimpleGrid>
        <FormField
          label="Boundary GeoJSON"
          htmlFor="boundary"
          hint='Polygon: {"type":"Polygon","coordinates":[[[lng,lat],...]]}'
        >
          <Textarea id="boundary" value={form.boundary_text} onChange={set("boundary_text")} />
        </FormField>
        <Button type="submit" colorScheme="brand" isDisabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save field" : "Create field"}
        </Button>
      </Box>
    </Box>
  );
}
