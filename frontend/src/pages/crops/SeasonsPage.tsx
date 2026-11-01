import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Checkbox, Input, Link, Text } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";

export default function SeasonsPage() {
  const qc = useQueryClient();
  const seasonsQ = useQuery({ queryKey: ["seasons"], queryFn: () => cropsApi.seasons() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", is_active: true });
  const create = useMutation({
    mutationFn: () => cropsApi.createSeason(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seasons"] });
      setOpen(false);
    },
  });

  return (
    <Box>
      <PageHeader
        title="Seasons"
        subtitle="Planning windows used by the top-bar season filter."
        crumbs={
          <>
            <Link as={RouterLink} to="/crops">
              Crops
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">Seasons</Text>
          </>
        }
        actions={
          <Button colorScheme="brand" onClick={() => setOpen(true)}>
            Add season
          </Button>
        }
      />
      <ErrorBanner message={seasonsQ.error ? getApiError(seasonsQ.error) : null} />
      <DataTable
        rows={seasonsQ.data?.results ?? []}
        rowKey={(s) => s.id}
        emptyTitle="No seasons"
        emptyBody="Create 2026 and mark it active before planting starts."
        columns={[
          { key: "name", header: "Season" },
          { key: "start_date", header: "Start", render: (s) => formatDate(s.start_date) },
          { key: "end_date", header: "End", render: (s) => formatDate(s.end_date) },
          {
            key: "is_active",
            header: "Status",
            render: (s) => <StatusBadge status={s.is_active ? "healthy" : "idle"} label={s.is_active ? "Active" : "Closed"} />,
          },
        ]}
      />
      <Drawer open={open} title="Add season" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Name" htmlFor="sname">
            <Input
              id="sname"
              isRequired
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="2026"
            />
          </FormField>
          <FormField label="Start" htmlFor="sstart">
            <Input
              id="sstart"
              type="date"
              isRequired
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </FormField>
          <FormField label="End" htmlFor="send">
            <Input
              id="send"
              type="date"
              isRequired
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </FormField>
          <Checkbox isChecked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}>
            Active season
          </Checkbox>
          <Box mt={3.5}>
            <Button type="submit" colorScheme="brand" isDisabled={create.isPending}>
              Save
            </Button>
          </Box>
        </form>
      </Drawer>
    </Box>
  );
}
