import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Input, Link, Select, Text } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Modal";

export default function VarietiesPage() {
  const qc = useQueryClient();
  const varsQ = useQuery({ queryKey: ["varieties"], queryFn: () => cropsApi.varieties() });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", crop: "", maturity_days: "110", traits: "" });
  const create = useMutation({
    mutationFn: () =>
      cropsApi.createVariety({ ...form, maturity_days: Number(form.maturity_days) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["varieties"] });
      setOpen(false);
    },
  });

  return (
    <Box>
      <PageHeader
        title="Varieties"
        subtitle="Hybrids, RM, and trait packages."
        crumbs={
          <>
            <Link as={RouterLink} to="/crops">
              Crops
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">Varieties</Text>
          </>
        }
        actions={
          <Button colorScheme="brand" onClick={() => setOpen(true)}>
            Add variety
          </Button>
        }
      />
      <ErrorBanner message={varsQ.error ? getApiError(varsQ.error) : null} />
      <DataTable
        rows={varsQ.data?.results ?? []}
        rowKey={(v) => v.id}
        emptyTitle="No varieties"
        emptyBody="Add P1197, AG27XF3, or your house wheat variety."
        columns={[
          { key: "name", header: "Variety" },
          { key: "crop_name", header: "Crop", render: (v) => v.crop_name ?? "—" },
          { key: "maturity_days", header: "Maturity days" },
          { key: "traits", header: "Traits" },
        ]}
      />
      <Drawer open={open} title="Add variety" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <FormField label="Name" htmlFor="vname">
            <Input id="vname" isRequired value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Crop" htmlFor="vcrop">
            <Select id="vcrop" isRequired value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value })}>
              <option value="">Select crop</option>
              {(cropsQ.data?.results ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Maturity days" htmlFor="vmat">
            <Input
              id="vmat"
              type="number"
              value={form.maturity_days}
              onChange={(e) => setForm({ ...form, maturity_days: e.target.value })}
            />
          </FormField>
          <FormField label="Traits" htmlFor="vtraits">
            <Input
              id="vtraits"
              value={form.traits}
              onChange={(e) => setForm({ ...form, traits: e.target.value })}
              placeholder="VT2P, Enlist, etc."
            />
          </FormField>
          <Button type="submit" colorScheme="brand" isDisabled={create.isPending}>
            Save
          </Button>
        </form>
      </Drawer>
    </Box>
  );
}
