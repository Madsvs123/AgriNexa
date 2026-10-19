import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { platformApi } from "@/api/client";
import type { NotificationItem } from "@/types";
import { fromNow } from "@/lib/utils";

export function NotificationPanel({
  items,
  onSeeAll,
}: {
  items: NotificationItem[];
  onSeeAll: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const read = useMutation({
    mutationFn: (id: string) => platformApi.readNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => platformApi.readAllNotifications(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div>
      <div className="row" style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
        <strong>Notifications</strong>
        <span className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => readAll.mutate()}>
          Mark all read
        </button>
      </div>
      {items.length === 0 ? (
        <p className="muted" style={{ padding: 16 }}>
          Quiet in the yard. Frost, sensor, and inventory alerts will land here.
        </p>
      ) : (
        items.map((n) => (
          <button
            key={n.id}
            type="button"
            className="dropdown-item"
            style={{ alignItems: "flex-start", opacity: n.is_read ? 0.65 : 1 }}
            onClick={() => {
              if (n.is_read) read.mutate(n.id);
              if (n.link) navigate("/notifications");
            }}
          >
            <div>
              <div>{n.title}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {n.body} · {fromNow(n.created_at)}
              </div>
            </div>
          </button>
        ))
      )}
      <div style={{ padding: 10 }}>
        <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={onSeeAll}>
          Open notification center
        </button>
      </div>
    </div>
  );
}
