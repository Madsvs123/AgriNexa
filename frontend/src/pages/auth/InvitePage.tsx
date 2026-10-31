import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApiError, tenancyApi } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { AuthLayout } from "./AuthLayout";
import { ErrorBanner, FormField } from "@/components/ui/FormField";

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await tenancyApi.acceptInvitation(token ?? "", {
        password: password || undefined,
        first_name: firstName,
        last_name: lastName,
      });
      if (data.access && data.refresh && data.user) {
        login({
          access: data.access,
          refresh: data.refresh,
          user: data.user,
          organizations: data.organizations ?? (data.organization ? [data.organization] : []),
        });
        navigate("/home");
        return;
      }
      navigate("/signin");
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Join the crew"
      subtitle="Accept this invitation to access farms, fields, and the operations map."
    >
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit}>
        <p className="muted">
          If you already have an AgriNexa account with this email, you can accept without a password while signed in.
          New operators should set a password below.
        </p>
        <div className="grid grid-2">
          <FormField label="First name" htmlFor="inv-first">
            <input
              id="inv-first"
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="inv-last">
            <input id="inv-last" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Password" htmlFor="inv-pass" hint="Required when creating a new account.">
          <input
            id="inv-pass"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={pending}>
          {pending ? "Accepting…" : "Accept invitation"}
        </button>
      </form>
    </AuthLayout>
  );
}
