import { useEffect, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Input, Link, Select, SimpleGrid, Text } from "@chakra-ui/react";
import { cropsApi, farmsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { BoundaryEditor } from "@/components/ui/BoundaryEditor";
import type { GeoJSONPolygon } from "@/types";
import { useTranslation } from "react-i18next";
import { usePlanningLabels } from "@/lib/usePlanningLabels";

export default function FieldFormPage() {
  const { t } = useTranslation("land");
  const labels = usePlanningLabels();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const fieldQ = useQuery({ queryKey: ["field", id], queryFn: () => farmsApi.getField(id!), enabled: isEdit });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [boundary, setBoundary] = useState<GeoJSONPolygon | null>(null);
  const [form, setForm] = useState({
    name: "",
    farm: "",
    acres: "",
    soil_type: "loam",
    crop: "",
    planting_date: "",
    harvest_date: "",
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
    });
    setBoundary(field.boundary ?? null);
  }, [fieldQ.data]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
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
        subtitle={t("fieldForm.subtitle")}
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
        <FormField label={t("fieldForm.fieldName")} htmlFor="fname" hint={t("fieldForm.nameHint")}>
          <Input id="fname" isRequired value={form.name} onChange={set("name")} />
        </FormField>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label={t("labels.farm", { ns: "common" })} htmlFor="farm">
            <Select id="farm" isRequired value={form.farm} onChange={set("farm")}>
              <option value="">{t("fieldForm.selectFarm")}</option>
              {(farmsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label={t("labels.acres", { ns: "common" })}
            htmlFor="facres"
            hint={boundary ? "Derived from the drawn boundary on save." : undefined}
          >
            <Input
              id="facres"
              type="number"
              step="0.1"
              isRequired
              isDisabled={Boolean(boundary)}
              value={form.acres}
              onChange={set("acres")}
            />
          </FormField>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label={t("fields.soilType")} htmlFor="soil">
            <Select id="soil" value={form.soil_type} onChange={set("soil_type")}>
              <option value="loam">{labels.soil("loam")}</option>
              <option value="clay_loam">{labels.soil("clay_loam")}</option>
              <option value="sandy_loam">{labels.soil("sandy_loam")}</option>
              <option value="silt_loam">{labels.soil("silt_loam")}</option>
            </Select>
          </FormField>
          <FormField label={t("fieldForm.currentCrop")} htmlFor="crop">
            <Select id="crop" value={form.crop} onChange={set("crop")}>
              <option value="">{t("fieldForm.fallow")}</option>
              {(cropsQ.data?.results ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label={t("fieldForm.plantingDate")} htmlFor="pdate">
            <Input id="pdate" type="date" value={form.planting_date} onChange={set("planting_date")} />
          </FormField>
          <FormField label={t("fieldForm.harvestDate")} htmlFor="hdate">
            <Input id="hdate" type="date" value={form.harvest_date} onChange={set("harvest_date")} />
          </FormField>
        </SimpleGrid>
        <FormField label={t("fieldForm.boundary")} htmlFor="boundary" hint={t("fieldForm.boundaryHint")}>
          <BoundaryEditor value={boundary} onChange={setBoundary} />
        </FormField>
        <Button type="submit" colorScheme="brand" isDisabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save field" : "Create field"}
        </Button>
      </Box>
    </Box>
  );
}
