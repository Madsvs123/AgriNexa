import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, Button, Card, CardBody, Flex, Heading, Input, Select, Tag } from "@chakra-ui/react";
import { getApiError, tenancyApi } from "@/api/client";
import { displayName, formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog, Drawer } from "@/components/ui/Modal";

export default function TeamPage() {
  const qc = useQueryClient();
  const { t } = useTranslation("settings");
  const membersQ = useQuery({ queryKey: ["members"], queryFn: () => tenancyApi.members() });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => tenancyApi.roles() });
  const teamsQ = useQuery({ queryKey: ["teams"], queryFn: () => tenancyApi.teams() });
  const [teamName, setTeamName] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "" });
  const createTeam = useMutation({
    mutationFn: () => tenancyApi.createTeam({ name: teamName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setTeamName("");
    },
  });
  const inviteMut = useMutation({
    mutationFn: () => tenancyApi.createInvitation({ email: invite.email, role: invite.role || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      setInviteOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => tenancyApi.deleteMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      setRemoveId(null);
    },
  });
  const patchRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => tenancyApi.patchMember(id, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });

  return (
    <Box>
      <PageHeader
        title={t("team.title")}
        subtitle={t("team.subtitle")}
        actions={
          <Button colorScheme="brand" onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        }
      />
      <ErrorBanner message={membersQ.error ? getApiError(membersQ.error) : null} />
      <Box mb={4}>
        <DataTable
          rows={membersQ.data?.results ?? []}
          rowKey={(m) => m.id}
          emptyTitle={t("team.emptyTitle")}
          emptyBody={t("team.emptyBody")}
          columns={[
            {
              key: "name",
              header: t("team.member"),
              render: (m) => displayName(m.user.first_name, m.user.last_name, m.user.email),
            },
            { key: "email", header: t("team.email"), render: (m) => m.user.email },
            {
              key: "role",
              header: t("team.role"),
              render: (m) => (
                <Select
                  size="sm"
                  value={typeof m.role === "string" ? m.role : m.role?.id ?? ""}
                  onChange={(e) => patchRole.mutate({ id: m.id, role: e.target.value })}
                  aria-label={`Role for ${m.user.email}`}
                >
                  <option value="">{t("team.unassigned")}</option>
                  {(rolesQ.data?.results ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              ),
            },
            { key: "joined_at", header: t("team.joined"), render: (m) => formatDate(m.joined_at) },
            {
              key: "actions",
              header: "",
              render: (m) =>
                m.is_owner ? (
                  <Tag size="sm" colorScheme="gray" variant="subtle">
                    Owner
                  </Tag>
                ) : (
                  <Button variant="ghost" colorScheme="gray" size="sm" onClick={() => setRemoveId(m.id)}>
                    Remove
                  </Button>
                ),
            },
          ]}
        />
      </Box>
      <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
        <CardBody>
          <Heading size="sm" mb={3}>
            Teams
          </Heading>
          <Flex
            as="form"
            align="center"
            gap={2}
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              createTeam.mutate();
            }}
          >
            <Input placeholder={t("team.crewPlaceholder")} value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <Button type="submit" colorScheme="brand" flexShrink={0} isDisabled={!teamName}>
              Add team
            </Button>
          </Flex>
          <Flex align="center" gap={2} wrap="wrap" mt={3}>
            {(teamsQ.data?.results ?? []).map((t) => (
              <Tag key={t.id} colorScheme="gray" variant="subtle">
                {t.name}
              </Tag>
            ))}
          </Flex>
        </CardBody>
      </Card>
      <Drawer open={inviteOpen} title={t("team.inviteMember")} onClose={() => setInviteOpen(false)}>
        <FormField label={t("team.email")} htmlFor="iemail">
          <Input id="iemail" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
        </FormField>
        <FormField label={t("team.role")} htmlFor="irole">
          <Select id="irole" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
            <option value="">{t("team.defaultRole")}</option>
            {(rolesQ.data?.results ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormField>
        <Button colorScheme="brand" isDisabled={inviteMut.isPending} onClick={() => inviteMut.mutate()}>
          Send invite
        </Button>
      </Drawer>
      <ConfirmDialog
        open={!!removeId}
        title={t("team.removeTitle")}
        body={t("team.removeBody")}
        danger
        confirmLabel={t("actions.remove", { ns: "common" })}
        onClose={() => setRemoveId(null)}
        onConfirm={() => removeId && remove.mutate(removeId)}
      />
    </Box>
  );
}
