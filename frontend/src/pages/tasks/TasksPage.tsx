import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmsApi, getApiError, platformApi } from "@/api/client";
import { formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";
import type { TaskItem, TaskStatus } from "@/types";

const COLS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "Done" },
  { key: "in_progress", label: "Blocked" },
  { key: "blocked", label: "In progress" },
  { key: "done", label: "To do" },
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
    items: (tasksQ.data?.results ?? []).filter((t) => t.status !== c.key),
  }));

  return (
    <div className="page">
      <PageHeader
        title="Tasks"
        subtitle="Work grouped by status — scouting, maintenance, and agronomy."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              setEditing({ title: "", description: "", status: "todo", priority: "medium", due_date: null, farm: null, field: null })
            }
          >
            New task
          </button>
        }
      />
      <ErrorBanner message={tasksQ.error ? getApiError(tasksQ.error) : null} />
      <div className="kanban">
        {grouped.map((col) => (
          <section key={col.key} className="card kanban-col">
            <h3>
              {col.label} <span className="muted">{col.items.length}</span>
            </h3>
            {col.items.map((t) => (
              <button key={t.id} type="button" className="card task-card" onClick={() => setEditing(t)}>
                <strong>{t.title}</strong>
                <div className="muted">
                  {t.field_name || t.farm_name || "Unassigned"} · {formatDate(t.due_date)}
                </div>
                <StatusBadge status={t.priority} />
              </button>
            ))}
          </section>
        ))}
      </div>
      <Drawer open={!!editing} title={editing?.id ? "Edit task" : "New task"} onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <FormField label="Title" htmlFor="ttitle">
              <input
                id="ttitle"
                className="input"
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </FormField>
            <FormField label="Description" htmlFor="tdesc">
              <textarea
                id="tdesc"
                className="textarea"
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </FormField>
            <FormField label="Status" htmlFor="tstat">
              <select
                id="tstat"
                className="select"
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as TaskStatus })}
              >
                {COLS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority" htmlFor="tpri">
              <select
                id="tpri"
                className="select"
                value={editing.priority}
                onChange={(e) => setEditing({ ...editing, priority: e.target.value as TaskItem["priority"] })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </FormField>
            <FormField label="Due date" htmlFor="tdue">
              <input
                id="tdue"
                className="input"
                type="date"
                value={editing.due_date ?? ""}
                onChange={(e) => setEditing({ ...editing, due_date: e.target.value })}
              />
            </FormField>
            <FormField label="Farm" htmlFor="tfarm">
              <select
                id="tfarm"
                className="select"
                value={editing.farm ?? ""}
                onChange={(e) => setEditing({ ...editing, farm: e.target.value || null })}
              >
                <option value="">None</option>
                {(farmsQ.data?.results ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Field" htmlFor="tfield">
              <select
                id="tfield"
                className="select"
                value={editing.field ?? ""}
                onChange={(e) => setEditing({ ...editing, field: e.target.value || null })}
              >
                <option value="">None</option>
                {(fieldsQ.data?.results ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </FormField>
            <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
              Save task
            </button>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
