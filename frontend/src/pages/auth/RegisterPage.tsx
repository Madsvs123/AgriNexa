import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authApi, getApiError } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { AuthLayout } from "./AuthLayout";
import { ErrorBanner, FormField } from "@/components/ui/FormField";

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.accessToken);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    organization_name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (token) return <Navigate to="/" replace />;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await authApi.register(form);
      login(data);
      navigate("/home");
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Start your season" subtitle="Create an organization for your farms and crew.">
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit}>
        <div className="grid grid-2">
          <FormField label="First name" htmlFor="first_name">
            <input id="first_name" className="input" required value={form.first_name} onChange={set("first_name")} />
          </FormField>
          <FormField label="Last name" htmlFor="last_name">
            <input id="last_name" className="input" required value={form.last_name} onChange={set("last_name")} />
          </FormField>
        </div>
        <FormField label="Work email" htmlFor="reg-email">
            <input id="reg-email" className="input" type="email" required value={form.email} onChange={set("email")} />
        </FormField>
        <FormField label="Password" htmlFor="reg-password" hint="At least 8 characters.">
          <input
            id="reg-password"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={form.password}
            onChange={set("password")}
          />
        </FormField>
        <FormField label="Organization name" htmlFor="org" hint="e.g. Prairie East Cooperative">
          <input
            id="org"
            className="input"
            required
            value={form.organization_name}
            onChange={set("organization_name")}
          />
        </FormField>
        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 14 }}>
        Already have access? <Link to="/signin">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
