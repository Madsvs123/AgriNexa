import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import { Button, Input, Link, SimpleGrid, Text } from "@chakra-ui/react";
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
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormField label="First name" htmlFor="first_name">
            <Input id="first_name" required value={form.first_name} onChange={set("first_name")} />
          </FormField>
          <FormField label="Last name" htmlFor="last_name">
            <Input id="last_name" required value={form.last_name} onChange={set("last_name")} />
          </FormField>
        </SimpleGrid>
        <FormField label="Work email" htmlFor="reg-email">
          <Input id="reg-email" type="email" required value={form.email} onChange={set("email")} />
        </FormField>
        <FormField label="Password" htmlFor="reg-password" hint="At least 8 characters.">
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={form.password}
            onChange={set("password")}
          />
        </FormField>
        <FormField label="Organization name" htmlFor="org" hint="e.g. Prairie East Cooperative">
          <Input id="org" required value={form.organization_name} onChange={set("organization_name")} />
        </FormField>
        <Button type="submit" colorScheme="brand" w="100%" isDisabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
      <Text color="fg.muted" mt={3.5}>
        Already have access?{" "}
        <Link as={RouterLink} to="/signin" color="brand.500">
          Sign in
        </Link>
      </Text>
    </AuthLayout>
  );
}
