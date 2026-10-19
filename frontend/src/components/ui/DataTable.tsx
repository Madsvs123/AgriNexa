import type { ReactNode } from "react";
import { EmptyState } from "./StatCard";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyTitle = "Nothing planted here yet",
  emptyBody = "When records exist they will appear in this table — try North Ridge or Willow Creek once data is synced.",
  emptyAction,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
}) {
  if (rows.length) {
    return <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />;
  }
  return (
    <div className="table-wrap">
      <table className="data-table"
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? "clickable" : undefined}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
