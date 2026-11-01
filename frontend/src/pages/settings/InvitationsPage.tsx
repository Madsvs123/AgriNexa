import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, Button } from "@chakra-ui/react";
import { getApiError, tenancyApi } from "@/api/client";
import { formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";

export default function InvitationsPage() {
  const { t } = useTranslation("settings");
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ["invitations"], queryFn: () => tenancyApi.invitations() });
  const resend = useMutation({
    mutationFn: (id: string) => tenancyApi.resendInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
  return (
    <Box>
      <PageHeader title={t("invitations.title")} subtitle={t("invitations.subtitle")} />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      <DataTable
        rows={listQ.data?.results ?? []}
        rowKey={(i) => i.id}
        emptyTitle={t("invitations.emptyTitle")}
        emptyBody={t("invitations.emptyBody")}
        columns={[
          { key: "email", header: t("invitations.email") },
          { key: "role_name", header: t("invitations.role"), render: (i) => i.role_name ?? "—" },
          { key: "status", header: t("invitations.status"), render: (i) => <StatusBadge status={i.status} /> },
          { key: "created_at", header: t("invitations.sent"), render: (i) => formatDate(i.created_at) },
          { key: "expires_at", header: t("invitations.expires"), render: (i) => formatDate(i.expires_at) },
          {
            key: "resend",
            header: "",
            render: (i) =>
              i.status === "pending" ? (
                <Button variant="ghost" colorScheme="gray" size="sm" onClick={() => resend.mutate(i.id)}>
                  Resend
                </Button>
              ) : null,
          },
        ]}
      />
    </Box>
  );
}
