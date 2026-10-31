import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiError, tenancyApi } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";

export default function OrganizationPage() {
  const orgId = useAuthStore((s) => s.currentOrgId);
  const setOrganizations = useAuthStore((s) => s.setOrganizations);
  const orgQ = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => tenancyApi.getOrganization(orgId!),
    enabled: !!orgId,
  });
  const settingsQ = useQuery({
    queryKey: ["org-settings", orgId],
    queryFn: () => tenancyApi.getOrgSettings(orgId!),
    enabled: !!orgId,
  });
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState({
    timezone: "America/Chicago",
    unit_system: "imperial" as "imperial" | "metric",
    currency: "USD",
    season_start_month: "3",
    legal_name: "",
    tax_id: "",
  });

  useEffect(() => {
    if (orgQ.data) setName(orgQ.data.name);
  }, [orgQ.data]);
  useEffect(() => {
    if (settingsQ.data) {
      setSettings({
        timezone: settingsQ.data.timezone || "America/Chicago",
        unit_system: settingsQ.data.unit_system || "imperial",
        currency: settingsQ.data.currency || "USD",
        season_start_month: String(settingsQ.data.season_start_month ?? 3),
        legal_name: settingsQ.data.legal_name ?? "",
        tax_id: settingsQ.data.tax_id ?? "",
      });
    }
  }, [settingsQ.data]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setError(null);
    try {
      await tenancyApi.patchOrganization(orgId, { name });
      await tenancyApi.patchOrgSettings(orgId, {
        ...settings,
        season_start_month: Number(settings.season_start_month),
      });
      const orgs = await tenancyApi.organizations();
      setOrganizations(orgs.results);
    } catch (err) {
      setError(getApiError(err));
    }
  };

  return (
    <div className="page">
      <PageHeader title="Organization" subtitle="Legal name, units, and default season calendar." />
      <ErrorBanner message={error} />
      <form className="card card-pad" style={{ maxWidth: 720 }} onSubmit={onSubmit}>
        <FormField label="Display name" htmlFor="oname">
          <input id="oname" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Legal name" htmlFor="olegal">
          <input id="olegal" className="input" value={settings.legal_name} onChange={(e) => setSettings({ ...settings, legal_name: e.target.value })} />
        </FormField>
        <FormField label="Tax ID" htmlFor="otax">
          <input id="otax" className="input" value={settings.tax_id} onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })} />
        </FormField>
        <div className="grid grid-2">
          <FormField label="Timezone" htmlFor="otz">
            <input id="otz" className="input" value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
          </FormField>
          <FormField label="Currency" htmlFor="ocur">
            <input id="ocur" className="input" value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
          </FormField>
        </div>
        <div className="grid grid-2">
          <FormField label="Unit system" htmlFor="ounit">
            <select
              id="ounit"
              className="select"
              value={settings.unit_system}
              onChange={(e) => setSettings({ ...settings, unit_system: e.target.value as "imperial" | "metric" })}
            >
              <option value="imperial">Imperial (acres, gallons)</option>
              <option value="metric">Metric (hectares, liters)</option>
            </select>
          </FormField>
          <FormField label="Season start month" htmlFor="oseason">
            <input
              id="oseason"
              className="input"
              type="number"
              min={1}
              max={12}
              value={settings.season_start_month}
              onChange={(e) => setSettings({ ...settings, season_start_month: e.target.value })}
            />
          </FormField>
        </div>
        <button type="submit" className="btn btn-primary">
          Save organization
        </button>
      </form>
    </div>
  );
}
