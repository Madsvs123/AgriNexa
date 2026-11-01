import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Input, Link, Select, Text, Textarea } from "@chakra-ui/react";
import { farmsApi, getApiError, scoutingApi } from "@/api/client";
import { formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";
import { useTranslation } from "react-i18next";

export default function TreatmentsPage() {
  const { t } = useTranslation("operate");
  const qc = useQueryClient();
  const treatQ = useQuery({ queryKey: ["treatments"], queryFn: () => scoutingApi.treatments() });
  const fieldsQ = useQuery({ queryKey: ["fields"], queryFn: () => farmsApi.fields() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    field: "",
    product: "",
    method: "foliar",
    scheduled_date: "",
    notes: "",
    status: "planned",
  });
  const create = useMutation({
    mutationFn: () => scoutingApi.createTreatment({ ...form, field: form.field }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatments"] });
      setOpen(false);
    },
  });

  return (
    <Box>
      <PageHeader
        title={t("treatments.title")}
        subtitle={t("treatments.subtitle")}
        crumbs={
          <>
            <Link as={RouterLink} to="/scouting">{t("scouting.title")}</Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">{t("treatments.heading")}</Text>
          </>
        }
        actions={
          <Button colorScheme="brand" onClick={() => setOpen(true)}>{t("treatments.newTreatment")}</Button>
        }
      />
      <ErrorBanner message={treatQ.error ? getApiError(treatQ.error) : null} />
      <DataTable
        rows={treatQ.data?.results ?? []}
        rowKey={(t) => t.id}
        emptyTitle={t("treatments.emptyTitle")}
        emptyBody={t("treatments.emptyBody")}
        columns={[
          { key: "field_name", header: t("labels.field", { ns: "common" }), render: (t) => t.field_name ?? "—" },
          { key: "product", header: t("treatments.product") },
          { key: "method", header: t("treatments.method") },
          { key: "scheduled_date", header: t("treatments.scheduled"), render: (t) => formatDate(t.scheduled_date) },
          { key: "status", header: t("labels.status", { ns: "common" }), render: (t) => <StatusBadge status={t.status} /> },
        ]}
      />
      <Drawer open={open} title={t("treatments.planTreatment")} onClose={() => setOpen(false)}>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label={t("labels.field", { ns: "common" })} htmlFor="tfield">
            <Select id="tfield" isRequired value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
              <option value="">{t("scouting.selectField")}</option>
              {(fieldsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("treatments.product")} htmlFor="tprod">
            <Input id="tprod" isRequired value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder={t("treatments.productPlaceholder")} />
          </FormField>
          <FormField label={t("treatments.method")} htmlFor="tmethod">
            <Input id="tmethod" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
          </FormField>
          <FormField label={t("treatments.scheduledDate")} htmlFor="tdate">
            <Input id="tdate" type="date" isRequired value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
          </FormField>
          <FormField label={t("labels.notes", { ns: "common" })} htmlFor="tnotes">
            <Textarea id="tnotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </FormField>
          <Button type="submit" colorScheme="brand" isDisabled={create.isPending}>{t("treatments.savePlan")}</Button>
        </form>
      </Drawer>
    </Box>
  );
}
