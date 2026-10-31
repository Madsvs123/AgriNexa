import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmsApi, getApiError, tenancyApi } from "@/api/client";
import { displayName } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";

export default function AccessPage() {
  const qc = useQueryClient();
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const membersQ = useQuery({ queryKey: ["members"], queryFn: () => tenancyApi.members() });
  const farmId = farmsQ.data?.results[0]?.id;
  const accessQ = useQuery({
    queryKey: ["farm-access-all", farmId],
    queryFn: async () => {
      const farms = farmsQ.data?.results ?? [];
      const rows = await Promise.all(farms.map(async (f) => ({ farm: f, access: await tenancyApi.farmAccess(f.id) })));
      return rows;
    },
    enabled: !!farmsQ.data,
  });
  const put = useMutation({
    mutationFn: (body: {
      farmId: string;
      user_id: string;
      can_view: boolean;
      can_edit: boolean;
      can_manage: boolean;
    }) => tenancyApi.putFarmAccess(body.farmId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farm-access-all"] }),
  });

  return (
    <div className="page">
      <PageHeader title="Farm access" subtitle="View / edit / manage matrix per farm and member." />
      <ErrorBanner message={accessQ.error ? getApiError(accessQ.error) : null} />
      {(accessQ.data ?? []).map(({ farm, access }) => (
        <section key={farm.id} className="card" style={{ marginBottom: 16 }}>
          <div className="card-pad">
            <h3>{farm.name}</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>View</th>
                <th>Edit</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {(membersQ.data?.results ?? []).map((m) => {
                const row = access.find((a) => a.user_id === m.user.id) ?? {
                  user_id: m.user.id,
                  can_view: false,
                  can_edit: false,
                  can_manage: false,
                };
                const save = (patch: Partial<typeof row>) =>
                  put.mutate({
                    farmId: farm.id,
                    user_id: m.user.id,
                    can_view: patch.can_view ?? row.can_view,
                    can_edit: patch.can_edit ?? row.can_edit,
                    can_manage: patch.can_manage ?? row.can_manage,
                  });
                return (
                  <tr key={m.id}>
                    <td>{displayName(m.user.first_name, m.user.last_name, m.user.email)}</td>
                    <td>
                      <input type="checkbox" checked={row.can_view} onChange={(e) => save({ can_view: e.target.checked })} aria-label="Can view" />
                    </td>
                    <td>
                      <input type="checkbox" checked={row.can_edit} onChange={(e) => save({ can_edit: e.target.checked })} aria-label="Can edit" />
                    </td>
                    <td>
                      <input type="checkbox" checked={row.can_manage} onChange={(e) => save({ can_manage: e.target.checked })} aria-label="Can manage" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
