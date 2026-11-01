import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { farmsApi, getApiError, platformApi } from "@/api/client";
import { formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";
import type { TaskItem, TaskStatus } from "@/types";

const COLS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export default function TasksPage() {
  const qc = useQueryClient();
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => platformApi.tasks() });
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const fieldsQ = useQuery({ queryKey: ["fields"], queryFn: () => farmsApi.fields() });
  const [editing, setEditing] = useState<Partial<TaskItem> | null>(null);
  const save = useMutation({
    mutationFn: () =>
      editing?.id
        ? platformApi.patchTask(editing.id, editing)
        : platformApi.createTask(editing ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setEditing(null);
    },
  });
  const grouped = COLS.map((c) => ({
    ...c,
    items: (tasksQ.data?.results ?? []).filter((t) => t.status === c.key),
  }));

  return (
    <Box>
      <PageHeader
        title="Tasks"
        subtitle="Work grouped by status — scouting, maintenance, and agronomy."
        actions={
          <Button
            colorScheme="brand"
            onClick={() =>
              setEditing({ title: "", description: "", status: "todo", priority: "medium", due_date: null, farm: null, field: null })
            }
          >
            New task
          </Button>
        }
      />
      <ErrorBanner message={tasksQ.error ? getApiError(tasksQ.error) : null} />
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
        {grouped.map((col) => (
          <Card key={col.key} variant="outline" borderColor="border.default" bg="bg.surface">
            <CardBody>
              <Heading size="sm" mb={3}>
                {col.label}{" "}
                <Text as="span" color="fg.muted" fontWeight="normal">
                  {col.items.length}
                </Text>
              </Heading>
              <Stack spacing={3}>
                {col.items.map((t) => (
                  <Box
                    key={t.id}
                    as="button"
                    type="button"
                    textAlign="left"
                    bg="bg.subtle"
                    borderWidth="1px"
                    borderColor="border.default"
                    borderRadius="lg"
                    p={3}
                    _hover={{ borderColor: "brand.400" }}
                    onClick={() => setEditing(t)}
                  >
                    <Text fontWeight="semibold">{t.title}</Text>
                    <Text fontSize="sm" color="fg.muted" mb={2}>
                      {t.field_name || t.farm_name || "Unassigned"} · {formatDate(t.due_date)}
                    </Text>
                    <StatusBadge status={t.priority} />
                  </Box>
                ))}
              </Stack>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
      <Drawer open={!!editing} title={editing?.id ? "Edit task" : "New task"} onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <FormField label="Title" htmlFor="ttitle">
              <Input
                id="ttitle"
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </FormField>
            <FormField label="Description" htmlFor="tdesc">
              <Textarea
                id="tdesc"
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </FormField>
            <FormField label="Status" htmlFor="tstat">
              <Select
                id="tstat"
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as TaskStatus })}
              >
                {COLS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority" htmlFor="tpri">
              <Select
                id="tpri"
                value={editing.priority}
                onChange={(e) => setEditing({ ...editing, priority: e.target.value as TaskItem["priority"] })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </FormField>
            <FormField label="Due date" htmlFor="tdue">
              <Input
                id="tdue"
                type="date"
                value={editing.due_date ?? ""}
                onChange={(e) => setEditing({ ...editing, due_date: e.target.value })}
              />
            </FormField>
            <FormField label="Farm" htmlFor="tfarm">
              <Select
                id="tfarm"
                value={editing.farm ?? ""}
                onChange={(e) => setEditing({ ...editing, farm: e.target.value || null })}
              >
                <option value="">None</option>
                {(farmsQ.data?.results ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Field" htmlFor="tfield">
              <Select
                id="tfield"
                value={editing.field ?? ""}
                onChange={(e) => setEditing({ ...editing, field: e.target.value || null })}
              >
                <option value="">None</option>
                {(fieldsQ.data?.results ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <Button colorScheme="brand" isDisabled={save.isPending} onClick={() => save.mutate()}>
              Save task
            </Button>
          </>
        ) : null}
      </Drawer>
    </Box>
  );
}
