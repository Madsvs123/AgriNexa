import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authApi, getApiError } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { AuthLayout } from "./AuthLayout";
import { ErrorBanner } from "@/components/ui/FormField";
import { FormField } from "@/components/ui/FormField";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.accessToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (token) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await authApi.login({ email, password });
      login(data);
      navigate("/home");
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your operations center.">
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit}>
        <FormField label="Work email" htmlFor="email">
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 14 }}>
        New grower? <Link to="/register">Create an organization</Link>
      </p>
    </AuthLayout>
  );
}
