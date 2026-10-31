import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiError, tenancyApi } from "@/api/client";
import { displayName, formatDate } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog, Drawer } from "@/components/ui/Modal";

export default function TeamPage() {
  const qc = useQueryClient();
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
    <div className="page">
      <PageHeader
        title="Team"
        subtitle="Members, roles, and working crews."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setInviteOpen(true)}>
            Invite member
          </button>
        }
      />
      <ErrorBanner message={membersQ.error ? getApiError(membersQ.error) : null} />
      <div className="card" style={{ marginBottom: 16 }}>
        <DataTable
          rows={membersQ.data?.results ?? []}
          rowKey={(m) => m.id}
          emptyTitle="No members"
          emptyBody="Invite an agronomist or operator to join this organization."
          columns={[
            {
              key: "name",
              header: "Member",
              render: (m) => displayName(m.user.first_name, m.user.last_name, m.user.email),
            },
            { key: "email", header: "Email", render: (m) => m.user.email },
            {
              key: "role",
              header: "Role",
              render: (m) => (
                <select
                  className="select"
                  value={typeof m.role === "string" ? m.role : m.role?.id ?? ""}
                  onChange={(e) => patchRole.mutate({ id: m.id, role: e.target.value })}
                  aria-label={`Role for ${m.user.email}`}
                >
                  <option value="">Unassigned</option>
                  {(rolesQ.data?.results ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ),
            },
            { key: "joined_at", header: "Joined", render: (m) => formatDate(m.joined_at) },
            {
              key: "actions",
              header: "",
              render: (m) =>
                m.is_owner ? (
                  <span className="chip">Owner</span>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoveId(m.id)}>
                    Remove
                  </button>
                ),
            },
          ]}
        />
      </div>
      <section className="card card-pad">
        <h3>Teams</h3>
        <form
          className="row"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            createTeam.mutate();
          }}
        >
          <input className="input" placeholder="Night irrigation crew" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={!teamName}>
            Add team
          </button>
        </form>
        <div className="row" style={{ flexWrap: "wrap", marginTop: 12 }}>
          {(teamsQ.data?.results ?? []).map((t) => (
            <span key={t.id} className="chip">
              {t.name}
            </span>
          ))}
        </div>
      </section>
      <Drawer open={inviteOpen} title="Invite member" onClose={() => setInviteOpen(false)}>
        <FormField label="Email" htmlFor="iemail">
          <input id="iemail" className="input" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
        </FormField>
        <FormField label="Role" htmlFor="irole">
          <select id="irole" className="select" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
            <option value="">Default</option>
            {(rolesQ.data?.results ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </FormField>
        <button type="button" className="btn btn-primary" disabled={inviteMut.isPending} onClick={() => inviteMut.mutate()}>
          Send invite
        </button>
      </Drawer>
      <ConfirmDialog
        open={!!removeId}
        title="Remove member?"
        body="They will lose access to this organization's farms and sensors."
        danger
        confirmLabel="Remove"
        onClose={() => setRemoveId(null)}
        onConfirm={() => removeId && remove.mutate(removeId)}
      />
    </div>
  );
}
