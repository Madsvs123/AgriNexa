import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button } from "@chakra-ui/react";
import { getApiError, tenancyApi } from "@/api/client";
import { formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatCard";

export default function InvitationsPage() {
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ["invitations"], queryFn: () => tenancyApi.invitations() });
  const resend = useMutation({
    mutationFn: (id: string) => tenancyApi.resendInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
  return (
    <Box>
      <PageHeader title="Invitations" subtitle="Pending seats for this organization." />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      <DataTable
        rows={listQ.data?.results ?? []}
        rowKey={(i) => i.id}
        emptyTitle="No invitations"
        emptyBody="Invite from Team when you need another operator on Willow Creek."
        columns={[
          { key: "email", header: "Email" },
          { key: "role_name", header: "Role", render: (i) => i.role_name ?? "—" },
          { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
          { key: "created_at", header: "Sent", render: (i) => formatDate(i.created_at) },
          { key: "expires_at", header: "Expires", render: (i) => formatDate(i.expires_at) },
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
