import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { farmsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";

export default function FarmFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const farmQ = useQuery({ queryKey: ["farm", id], queryFn: () => farmsApi.get(id!), enabled: isEdit });
  const regionsQ = useQuery({ queryKey: ["regions"], queryFn: () => farmsApi.regions() });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    lat: "",
    lng: "",
    total_acres: "",
    timezone: "America/Chicago",
    region_id: "",
  });

  useEffect(() => {
    if (!farmQ.data) return;
    const f = farmQ.data;
    setForm({
      name: f.name,
      code: f.code,
      address: f.address ?? "",
      lat: f.lat != null ? String(f.lat) : "",
      lng: f.lng != null ? String(f.lng) : "",
      total_acres: String(f.total_acres ?? ""),
      timezone: f.timezone || "America/Chicago",
      region_id: f.region_id ?? f.region?.id ?? "",
    });
  }, [farmQ.data]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      name: form.name,
      code: form.code,
      address: form.address,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
      total_acres: form.total_acres ? Number(form.total_acres) : 0,
      timezone: form.timezone,
      region_id: form.region_id || null,
    };
    try {
      const saved = isEdit ? await farmsApi.patch(id!, body) : await farmsApi.create(body);
      navigate(`/farms/${saved.id}`);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title={isEdit ? "Edit farm" : "New farm"}
        subtitle="Codes should match your accounting and FSA records."
        crumbs={
          <>
            <Link to="/farms">Farms</Link>
            <span>/</span>
            <span>{isEdit ? "Edit" : "New"}</span>
          </>
        }
      />
      <ErrorBanner message={error} />
      <form className="card card-pad" style={{ maxWidth: 720 }} onSubmit={onSubmit}>
        <FormField label="Farm name" htmlFor="name" hint="e.g. North Ridge">
          <input id="name" className="input" required value={form.name} onChange={set("name")} />
        </FormField>
        <div className="grid grid-2">
          <FormField label="Code" htmlFor="code">
            <input id="code" className="input" required value={form.code} onChange={set("code")} />
          </FormField>
          <FormField label="Total acres" htmlFor="acres">
            <input id="acres" className="input" type="number" step="0.1" value={form.total_acres} onChange={set("total_acres")} />
          </FormField>
        </div>
        <FormField label="Address" htmlFor="address">
          <input id="address" className="input" value={form.address} onChange={set("address")} />
        </FormField>
        <div className="grid grid-2">
          <FormField label="Latitude" htmlFor="lat">
            <input id="lat" className="input" value={form.lat} onChange={set("lat")} />
          </FormField>
          <FormField label="Longitude" htmlFor="lng">
            <input id="lng" className="input" value={form.lng} onChange={set("lng")} />
          </FormField>
        </div>
        <div className="grid grid-2">
          <FormField label="Timezone" htmlFor="tz">
            <input id="tz" className="input" value={form.timezone} onChange={set("timezone")} />
          </FormField>
          <FormField label="Region" htmlFor="region">
            <select id="region" className="select" value={form.region_id} onChange={set("region_id")}>
              <option value="">Unassigned</option>
              {(regionsQ.data?.results ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save farm"}
        </button>
      </form>
    </div>
  );
}
