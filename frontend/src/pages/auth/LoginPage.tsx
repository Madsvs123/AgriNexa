import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import { Button, Input, Link, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { authApi, getApiError } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { AuthLayout } from "./AuthLayout";
import { ErrorBanner } from "@/components/ui/FormField";
import { FormField } from "@/components/ui/FormField";

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
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
    <AuthLayout title={t("login.title")} subtitle={t("login.subtitle")}>
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit}>
        <FormField label={t("fields.email")} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label={t("fields.password")} htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <Button type="submit" colorScheme="brand" w="100%" isDisabled={pending}>
          {pending ? t("signingIn") : t("signIn")}
        </Button>
      </form>
      <Text color="fg.muted" mt={3.5}>
        {t("login.newGrower")}{" "}
        <Link as={RouterLink} to="/register" color="brand.500">
          {t("login.createLink")}
        </Link>
      </Text>
    </AuthLayout>
  );
}
