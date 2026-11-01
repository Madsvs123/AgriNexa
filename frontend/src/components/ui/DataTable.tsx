import type { ReactNode } from "react";
import { Table, TableContainer, Tbody, Td, Th, Thead, Tr } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
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
  emptyTitle,
  emptyBody,
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
  const { t } = useTranslation("common");

  if (!rows.length) {
    return (
      <EmptyState
        title={emptyTitle ?? t("table.empty")}
        body={emptyBody ?? t("table.emptyBody")}
        action={emptyAction}
      />
    );
  }
  return (
    <TableContainer bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl">
      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            {columns.map((c) => (
              <Th key={c.key}>{c.header}</Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <Tr
              key={rowKey(row)}
              cursor={onRowClick ? "pointer" : undefined}
              _hover={onRowClick ? { bg: "bg.subtle" } : undefined}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((c) => (
                <Td key={c.key}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
