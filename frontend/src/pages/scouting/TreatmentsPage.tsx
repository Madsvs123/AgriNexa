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

export default function TreatmentsPage() {
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
        title="Treatments"
        subtitle="Spray plans and follow-up tasks from scouting."
        crumbs={
          <>
            <Link as={RouterLink} to="/scouting">
              Scouting
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">Treatments</Text>
          </>
        }
        actions={
          <Button colorScheme="brand" onClick={() => setOpen(true)}>
            New treatment
          </Button>
        }
      />
      <ErrorBanner message={treatQ.error ? getApiError(treatQ.error) : null} />
      <DataTable
        rows={treatQ.data?.results ?? []}
        rowKey={(t) => t.id}
        emptyTitle="No treatments"
        emptyBody="After a scout walk, schedule a fungicide or herbicide follow-up."
        columns={[
          { key: "field_name", header: "Field", render: (t) => t.field_name ?? "—" },
          { key: "product", header: "Product" },
          { key: "method", header: "Method" },
          { key: "scheduled_date", header: "Scheduled", render: (t) => formatDate(t.scheduled_date) },
          { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
        ]}
      />
      <Drawer open={open} title="Plan treatment" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Field" htmlFor="tfield">
            <Select id="tfield" isRequired value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
              <option value="">Select field</option>
              {(fieldsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Product" htmlFor="tprod">
            <Input id="tprod" isRequired value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Headline AMP" />
          </FormField>
          <FormField label="Method" htmlFor="tmethod">
            <Input id="tmethod" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
          </FormField>
          <FormField label="Scheduled date" htmlFor="tdate">
            <Input id="tdate" type="date" isRequired value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
          </FormField>
          <FormField label="Notes" htmlFor="tnotes">
            <Textarea id="tnotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </FormField>
          <Button type="submit" colorScheme="brand" isDisabled={create.isPending}>
            Save plan
          </Button>
        </form>
      </Drawer>
    </Box>
  );
}
