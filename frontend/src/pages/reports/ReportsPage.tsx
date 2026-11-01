import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Input, Link, Select, SimpleGrid } from "@chakra-ui/react";
import { analyticsApi, farmsApi, getApiError } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { useTranslation } from "react-i18next";

export default function ReportsPage() {
  const { t } = useTranslation("insights");
  const qc = useQueryClient();
  const reportsQ = useQuery({ queryKey: ["reports"], queryFn: () => analyticsApi.reports() });
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const [form, setForm] = useState({
    report_type: "yield_summary",
    farm: "",
    start: "",
    end: "",
  });
  const gen = useMutation({
    mutationFn: () =>
      analyticsApi.generateReport({
        report_type: form.report_type,
        params: { farm: form.farm || undefined, start: form.start, end: form.end },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });

  return (
    <Box>
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />
      <ErrorBanner message={reportsQ.error ? getApiError(reportsQ.error) : gen.error ? getApiError(gen.error) : null} />
      <Box
        as="form"
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.default"
        borderRadius="xl"
        p={5}
        mb={4}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          gen.mutate();
        }}
      >
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          <FormField label={t("reports.reportType")} htmlFor="rtype">
            <Select id="rtype" value={form.report_type} onChange={(e) => setForm({ ...form, report_type: e.target.value })}>
              <option value="yield_summary">{t("reports.yieldSummary")}</option>
              <option value="water_use">{t("reports.waterUse")}</option>
              <option value="input_costs">{t("reports.inputCosts")}</option>
              <option value="field_health">{t("reports.fieldHealth")}</option>
              <option value="scouting">{t("reports.scoutingPacket")}</option>
            </Select>
          </FormField>
          <FormField label={t("labels.farm", { ns: "common" })} htmlFor="rfarm">
            <Select id="rfarm" value={form.farm} onChange={(e) => setForm({ ...form, farm: e.target.value })}>
              <option value="">{t("reports.allFarms")}</option>
              {(farmsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("reports.start")} htmlFor="rstart">
            <Input id="rstart" type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </FormField>
          <FormField label={t("reports.end")} htmlFor="rend">
            <Input id="rend" type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </FormField>
        </SimpleGrid>
        <Button type="submit" colorScheme="brand" isDisabled={gen.isPending}>
          {gen.isPending ? "Queuing…" : "Generate report"}
        </Button>
      </Box>
      <DataTable
        rows={reportsQ.data?.results ?? []}
        rowKey={(r) => r.id}
        emptyTitle={t("reports.emptyTitle")}
        emptyBody={t("reports.emptyBody")}
        columns={[
          { key: "report_type", header: t("reports.type") },
          { key: "created_at", header: t("reports.created"), render: (r) => formatDateTime(r.created_at) },
          { key: "status", header: t("labels.status", { ns: "common" }), render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "file",
            header: t("reports.file"),
            render: (r) =>
              r.file ? (
                <Link href={r.file} isExternal color="brand.500">{t("actions.download", { ns: "common" })}</Link>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </Box>
  );
}
