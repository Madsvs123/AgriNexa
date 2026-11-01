import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Input, Select, SimpleGrid, Text, Textarea } from "@chakra-ui/react";
import { authApi, getApiError } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { useTranslation } from "react-i18next";
import { LANGUAGES, SUPPORTED_LANGUAGES, isLanguage } from "@/i18n/config";
import { setLanguage } from "@/i18n/locale";

export default function ProfilePage() {
  const { t } = useTranslation("settings");
  const setUser = useAuthStore((s) => s.setUser);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => authApi.me() });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => authApi.profile() });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [userForm, setUserForm] = useState({ first_name: "", last_name: "", email: "" });
  const [profile, setProfile] = useState({
    phone: "",
    bio: "",
    certifications: "",
    specialties: "",
    years_experience: "0",
    license_number: "",
  });
  // "" means no stored preference, so detection keeps applying.
  const [language, setLanguageField] = useState("");

  useEffect(() => {
    if (meQ.data) {
      setUserForm({
        first_name: meQ.data.first_name,
        last_name: meQ.data.last_name,
        email: meQ.data.email,
      });
    }
  }, [meQ.data]);
  useEffect(() => {
    if (profileQ.data) {
      setProfile({
        phone: profileQ.data.phone ?? "",
        bio: profileQ.data.bio ?? "",
        certifications: profileQ.data.certifications ?? "",
        specialties: profileQ.data.specialties ?? "",
        years_experience: String(profileQ.data.years_experience ?? 0),
        license_number: profileQ.data.license_number ?? "",
      });
      setLanguageField(profileQ.data.preferred_language ?? "");
    }
  }, [profileQ.data]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const user = await authApi.patchMe(userForm);
      setUser(user);
      await authApi.patchProfile({
        ...profile,
        years_experience: Number(profile.years_experience),
        preferred_language: language as never,
      });
      // Apply the choice immediately rather than waiting for a reload. An
      // empty value hands control back to location and browser detection.
      if (isLanguage(language)) await setLanguage(language);
      setSaved(true);
    } catch (err) {
      setError(getApiError(err));
    }
  };

  return (
    <Box>
      <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />
      <ErrorBanner message={error} />
      {saved ? (
        <Text color="fg.muted" mb={3}>
          {t("profile.saved", "Saved.")}
        </Text>
      ) : null}
      <Box
        as="form"
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.default"
        borderRadius="xl"
        p={5}
        maxW="720px"
        onSubmit={onSubmit}
      >
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormField label={t("profile.firstName")} htmlFor="pfn">
            <Input id="pfn" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} />
          </FormField>
          <FormField label={t("profile.lastName")} htmlFor="pln">
            <Input id="pln" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} />
          </FormField>
        </SimpleGrid>
        <FormField label={t("profile.email")} htmlFor="pemail">
          <Input id="pemail" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
        </FormField>
        <FormField label={t("profile.phone")} htmlFor="pphone">
          <Input id="pphone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
        </FormField>
        <FormField label={t("profile.language")} htmlFor="plang" hint={t("profile.languageHint")}>
          <Select id="plang" value={language} onChange={(e) => setLanguageField(e.target.value)}>
            <option value="">{t("profile.languageAuto")}</option>
            {SUPPORTED_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGES[code].nativeName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("profile.certifications")} htmlFor="pcert" hint={t("profile.certificationsHint")}>
          <Input id="pcert" value={profile.certifications} onChange={(e) => setProfile({ ...profile, certifications: e.target.value })} />
        </FormField>
        <FormField label={t("profile.specialties")} htmlFor="pspec" hint={t("profile.specialtiesHint")}>
          <Input id="pspec" value={profile.specialties} onChange={(e) => setProfile({ ...profile, specialties: e.target.value })} />
        </FormField>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <FormField label={t("profile.yearsExperience")} htmlFor="pexp">
            <Input
              id="pexp"
              type="number"
              value={profile.years_experience}
              onChange={(e) => setProfile({ ...profile, years_experience: e.target.value })}
            />
          </FormField>
          <FormField label={t("profile.licenseNumber")} htmlFor="plic">
            <Input id="plic" value={profile.license_number} onChange={(e) => setProfile({ ...profile, license_number: e.target.value })} />
          </FormField>
        </SimpleGrid>
        <FormField label={t("profile.bio")} htmlFor="pbio">
          <Textarea id="pbio" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
        </FormField>
        <Button type="submit" colorScheme="brand">
          Save profile
        </Button>
      </Box>
    </Box>
  );
}
