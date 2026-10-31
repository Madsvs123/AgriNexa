import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { farmsApi, getApiError, scoutingApi } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { FileDrop } from "@/components/ui/FileDrop";
import { SeverityMeter } from "@/components/ui/SensorSparkline";

const STEPS = ["Field", "Health", "Pests", "Photos", "Review"];

export default function ScoutReportNewPage() {
  const navigate = useNavigate();
  const fieldsQ = useQuery({ queryKey: ["fields"], queryFn: () => farmsApi.fields() });
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    field: "",
    health_score: 7,
    severity: "medium" as "low" | "medium" | "high" | "critical",
    notes: "",
    diseases: "",
    pests: "",
    weeds: "",
  });

  const parseList = (raw: string) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name, severity: form.severity }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = {
        field: form.field,
        health_score: form.health_score,
        severity: form.severity,
        notes: form.notes,
        diseases: parseList(form.diseases),
        pests: parseList(form.pests),
        weeds: parseList(form.weeds),
        photos: [] as { caption: string }[],
      };
      if (files.length) {
        const fd = new FormData();
        fd.append("field", form.field);
        fd.append("health_score", String(form.health_score));
        fd.append("severity", form.severity);
        fd.append("notes", form.notes);
        fd.append("diseases", JSON.stringify(payload.diseases));
        fd.append("pests", JSON.stringify(payload.pests));
        fd.append("weeds", JSON.stringify(payload.weeds));
        files.forEach((f) => fd.append("photos", f));
        const saved = await scoutingApi.createReport(fd);
        navigate(`/scouting/${saved.id}`);
      } else {
        const saved = await scoutingApi.createReport(payload);
        navigate(`/scouting/${saved.id}`);
      }
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="New scout report"
        subtitle="Five-step walk: field, health, findings, photos, submit."
        crumbs={
          <>
            <Link to="/scouting">Scouting</Link>
            <span>/</span>
            <span>New</span>
          </>
        }
      />
      <ErrorBanner message={error} />
      <div className="tabs">
        {STEPS.map((s, i) => (
          <button key={s} type="button" className={i === step ? "tab active" : "tab"} onClick={() => setStep(i)}>
            {i + 1}. {s}
          </button>
        ))}
      </div>
      <form className="card card-pad" style={{ maxWidth: 720 }} onSubmit={onSubmit}>
        {step === 0 ? (
          <FormField label="Field" htmlFor="sfield">
            <select id="sfield" className="select" required value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
              <option value="">Select field</option>
              {(fieldsQ.data?.results ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {f.farm_name}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
        {step === 1 ? (
          <>
            <FormField label="Canopy health (1–10)" htmlFor="health">
              <input
                id="health"
                className="input"
                type="number"
                min={1}
                max={10}
                value={form.health_score}
                onChange={(e) => setForm({ ...form, health_score: Number(e.target.value) })}
              />
            </FormField>
            <FormField label="Overall severity" htmlFor="sev">
              <select
                id="sev"
                className="select"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as typeof form.severity })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </FormField>
            <SeverityMeter value={form.severity} />
            <FormField label="Notes" htmlFor="snotes">
              <textarea id="snotes" className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Uneven stand on the west headland…" />
            </FormField>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <FormField label="Diseases" htmlFor="dis" hint="Comma-separated, e.g. Gray leaf spot, Northern corn leaf blight">
              <input id="dis" className="input" value={form.diseases} onChange={(e) => setForm({ ...form, diseases: e.target.value })} />
            </FormField>
            <FormField label="Pests" htmlFor="pests" hint="e.g. Corn rootworm, Japanese beetle">
              <input id="pests" className="input" value={form.pests} onChange={(e) => setForm({ ...form, pests: e.target.value })} />
            </FormField>
            <FormField label="Weeds" htmlFor="weeds" hint="e.g. Waterhemp, Foxtail">
              <input id="weeds" className="input" value={form.weeds} onChange={(e) => setForm({ ...form, weeds: e.target.value })} />
            </FormField>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <FileDrop accept="image/*" multiple onFiles={setFiles} label="Drop canopy or pest photos" />
            <p className="muted">{files.length} file(s) attached.</p>
          </>
        ) : null}
        {step === 4 ? (
          <div>
            <p>
              Field selected: <strong>{fieldsQ.data?.results.find((f) => f.id === form.field)?.name ?? "—"}</strong>
            </p>
            <p>Health {form.health_score} · {form.severity}</p>
            <p>{form.notes || "No narrative notes."}</p>
          </div>
        ) : null}
        <div className="row" style={{ marginTop: 16 }}>
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : null}
          <span className="spacer" />
          {step < 4 ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={pending || !form.field}>
              {pending ? "Saving…" : "Submit report"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
