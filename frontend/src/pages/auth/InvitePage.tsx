import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Input, SimpleGrid, Text } from "@chakra-ui/react";
import { getApiError, tenancyApi } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { AuthLayout } from "./AuthLayout";
import { ErrorBanner, FormField } from "@/components/ui/FormField";
import { useTranslation } from "react-i18next";

export default function InvitePage() {
  const { t } = useTranslation("insights");
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
      title={t("invite.title")}
      subtitle={t("invite.subtitle")}
    >
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit}>
        <Text color="fg.muted" mb={4}>
          If you already have an AgriNexa account with this email, you can accept without a password while signed in.
          New operators should set a password below.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormField label={t("fields.firstName", { ns: "auth" })} htmlFor="inv-first">
            <Input id="inv-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </FormField>
          <FormField label={t("fields.lastName", { ns: "auth" })} htmlFor="inv-last">
            <Input id="inv-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </FormField>
        </SimpleGrid>
        <FormField label={t("fields.password", { ns: "auth" })} htmlFor="inv-pass" hint={t("invite.passwordHint")}>
          <Input
            id="inv-pass"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <Button type="submit" colorScheme="brand" w="100%" mt={2} isDisabled={pending}>
          {pending ? "Accepting…" : "Accept invitation"}
        </Button>
      </form>
    </AuthLayout>
  );
}
