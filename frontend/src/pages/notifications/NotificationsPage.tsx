import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiError, platformApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { EmptyState } from "@/components/ui/StatCard";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ["notifications"], queryFn: () => platformApi.notifications() });
  const read = useMutation({
    mutationFn: (id: string) => platformApi.readNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => platformApi.readAllNotifications(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        subtitle="Sensor, frost, inventory, and task alerts."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => readAll.mutate()}>
            Mark all read
          </button>
        }
      />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      {(listQ.data?.results ?? []).length === 0 ? (
        <div className="card">
          <EmptyState title="Inbox is quiet" body="When a probe goes critical or MAP hits reorder, it will land here." />
        </div>
      ) : (
        <div className="stack">
          {(listQ.data?.results ?? []).map((n) => (
            <article key={n.id} className="card card-pad" style={{ opacity: n.is_read ? 0.7 : 1 }}>
              <div className="row">
                <strong>{n.title}</strong>
                <span className="spacer" />
                <span className="chip">{n.category}</span>
              </div>
              <p>{n.body}</p>
              <div className="muted">{formatDateTime(n.created_at)}</div>
              {n.is_read ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => read.mutate(n.id)}>
                  Mark read
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
