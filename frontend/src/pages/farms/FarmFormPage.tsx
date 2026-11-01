import { useEffect, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Input, Link, Select, SimpleGrid, Text } from "@chakra-ui/react";
import { farmsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { useTranslation } from "react-i18next";

export default function FarmFormPage() {
  const { t } = useTranslation("land");
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const farmQ = useQuery({ queryKey: ["farm", id], queryFn: () => farmsApi.get(id!), enabled: isEdit });
  const regionsQ = useQuery({ queryKey: ["regions"], queryFn: () => farmsApi.regions() });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    lat: "",
    lng: "",
    total_acres: "",
    timezone: "America/Chicago",
    region_id: "",
  });

  useEffect(() => {
    if (!farmQ.data) return;
    const f = farmQ.data;
    setForm({
      name: f.name,
      code: f.code,
      address: f.address ?? "",
      lat: f.lat != null ? String(f.lat) : "",
      lng: f.lng != null ? String(f.lng) : "",
      total_acres: String(f.total_acres ?? ""),
      timezone: f.timezone || "America/Chicago",
      region_id: f.region_id ?? f.region?.id ?? "",
    });
  }, [farmQ.data]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      name: form.name,
      code: form.code,
      address: form.address,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
      total_acres: form.total_acres ? Number(form.total_acres) : 0,
      timezone: form.timezone,
      region_id: form.region_id || null,
    };
    try {
      const saved = isEdit ? await farmsApi.patch(id!, body) : await farmsApi.create(body);
      navigate(`/farms/${saved.id}`);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title={isEdit ? "Edit farm" : "New farm"}
        subtitle={t("farmForm.subtitle")}
        crumbs={
          <>
            <Link as={RouterLink} to="/farms">
              Farms
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
        <FormField label={t("farmForm.farmName")} htmlFor="name" hint={t("farmForm.nameHint")}>
          <Input id="name" isRequired value={form.name} onChange={set("name")} />
        </FormField>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label={t("farmForm.code")} htmlFor="code">
            <Input id="code" isRequired value={form.code} onChange={set("code")} />
          </FormField>
          <FormField label={t("farmForm.totalAcres")} htmlFor="acres">
            <Input id="acres" type="number" step="0.1" value={form.total_acres} onChange={set("total_acres")} />
          </FormField>
        </SimpleGrid>
        <FormField label={t("farmForm.address")} htmlFor="address">
          <Input id="address" value={form.address} onChange={set("address")} />
        </FormField>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label={t("farmForm.latitude")} htmlFor="lat">
            <Input id="lat" value={form.lat} onChange={set("lat")} />
          </FormField>
          <FormField label={t("farmForm.longitude")} htmlFor="lng">
            <Input id="lng" value={form.lng} onChange={set("lng")} />
          </FormField>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4}>
          <FormField label={t("farmForm.timezone")} htmlFor="tz">
            <Input id="tz" value={form.timezone} onChange={set("timezone")} />
          </FormField>
          <FormField label={t("farmForm.region")} htmlFor="region">
            <Select id="region" value={form.region_id} onChange={set("region_id")}>
              <option value="">{t("farmForm.unassigned")}</option>
              {(regionsQ.data?.results ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </FormField>
        </SimpleGrid>
        <Button type="submit" colorScheme="brand" isDisabled={pending}>
          {pending ? "Saving…" : "Save farm"}
        </Button>
      </Box>
    </Box>
  );
}
