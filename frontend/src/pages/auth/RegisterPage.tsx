import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import { Button, Input, Link, SimpleGrid, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { authApi, getApiError } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { AuthLayout } from "./AuthLayout";
import { ErrorBanner, FormField } from "@/components/ui/FormField";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
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
    <AuthLayout title={t("register.title")} subtitle={t("register.subtitle")}>
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormField label={t("fields.firstName")} htmlFor="first_name">
            <Input id="first_name" required value={form.first_name} onChange={set("first_name")} />
          </FormField>
          <FormField label={t("fields.lastName")} htmlFor="last_name">
            <Input id="last_name" required value={form.last_name} onChange={set("last_name")} />
          </FormField>
        </SimpleGrid>
        <FormField label={t("fields.email")} htmlFor="reg-email">
          <Input id="reg-email" type="email" required value={form.email} onChange={set("email")} />
        </FormField>
        <FormField label={t("fields.password")} htmlFor="reg-password" hint={t("register.passwordHint")}>
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
        <FormField label={t("fields.organizationName")} htmlFor="org" hint={t("register.orgHint")}>
          <Input id="org" required value={form.organization_name} onChange={set("organization_name")} />
        </FormField>
        <Button type="submit" colorScheme="brand" w="100%" isDisabled={pending}>
          {pending ? t("register.submitting") : t("register.submit")}
        </Button>
      </form>
      <Text color="fg.muted" mt={3.5}>
        {t("register.haveAccount")}{" "}
        <Link as={RouterLink} to="/signin" color="brand.500">
          {t("register.signInLink")}
        </Link>
      </Text>
    </AuthLayout>
  );
}
