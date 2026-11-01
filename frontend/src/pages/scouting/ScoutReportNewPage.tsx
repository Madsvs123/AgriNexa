import { useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Input,
  Link,
  Select,
  Spacer,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { farmsApi, getApiError, scoutingApi } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { FileDrop } from "@/components/ui/FileDrop";
import { SeverityMeter } from "@/components/ui/SensorSparkline";
import { useTranslation } from "react-i18next";

const STEPS = ["Field", "Health", "Pests", "Photos", "Review"];

export default function ScoutReportNewPage() {
  const { t } = useTranslation("operate");
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
    <Box>
      <PageHeader
        title={t("scouting.newTitle")}
        subtitle={t("scouting.newSubtitle")}
        crumbs={
          <>
            <Link as={RouterLink} to="/scouting">{t("scouting.title")}</Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">New</Text>
          </>
        }
      />
      <ErrorBanner message={error} />
      <Flex gap={2} wrap="wrap" mb={4}>
        {STEPS.map((s, i) => (
          <Button
            key={s}
            size="sm"
            variant={i === step ? "solid" : "ghost"}
            colorScheme={i === step ? "brand" : "gray"}
            onClick={() => setStep(i)}
          >
            {i + 1}. {s}
          </Button>
        ))}
      </Flex>
      <Card as="form" variant="outline" borderColor="border.default" bg="bg.surface" maxW="720px" onSubmit={onSubmit}>
        <CardBody>
          {step === 0 ? (
            <FormField label={t("labels.field", { ns: "common" })} htmlFor="sfield">
              <Select id="sfield" isRequired value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
                <option value="">{t("scouting.selectField")}</option>
                {(fieldsQ.data?.results ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.farm_name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          {step === 1 ? (
            <>
              <FormField label={t("scouting.canopyHealth")} htmlFor="health">
                <Input
                  id="health"
                  type="number"
                  min={1}
                  max={10}
                  value={form.health_score}
                  onChange={(e) => setForm({ ...form, health_score: Number(e.target.value) })}
                />
              </FormField>
              <FormField label={t("scouting.overallSeverity")} htmlFor="sev">
                <Select
                  id="sev"
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as typeof form.severity })}
                >
                  <option value="low">Low</option>
                  <option value="medium">{t("severity.medium", { ns: "common" })}</option>
                  <option value="high">{t("severity.high", { ns: "common" })}</option>
                  <option value="critical">{t("severity.critical", { ns: "common" })}</option>
                </Select>
              </FormField>
              <SeverityMeter value={form.severity} />
              <FormField label={t("labels.notes", { ns: "common" })} htmlFor="snotes">
                <Textarea id="snotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("scouting.notesPlaceholder")} />
              </FormField>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <FormField label={t("scouting.diseases")} htmlFor="dis" hint={t("scouting.diseasesHint")}>
                <Input id="dis" value={form.diseases} onChange={(e) => setForm({ ...form, diseases: e.target.value })} />
              </FormField>
              <FormField label={t("scouting.pests")} htmlFor="pests" hint={t("scouting.pestsHint")}>
                <Input id="pests" value={form.pests} onChange={(e) => setForm({ ...form, pests: e.target.value })} />
              </FormField>
              <FormField label={t("scouting.weeds")} htmlFor="weeds" hint={t("scouting.weedsHint")}>
                <Input id="weeds" value={form.weeds} onChange={(e) => setForm({ ...form, weeds: e.target.value })} />
              </FormField>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <FileDrop accept="image/*" multiple onFiles={setFiles} label={t("scouting.dropPhotos")} />
              <Text color="fg.muted">{files.length} file(s) attached.</Text>
            </>
          ) : null}
          {step === 4 ? (
            <Box>
              <Text>
                Field selected: <Text as="strong">{fieldsQ.data?.results.find((f) => f.id === form.field)?.name ?? "—"}</Text>
              </Text>
              <Text>
                Health {form.health_score} · {form.severity}
              </Text>
              <Text>{form.notes || "No narrative notes."}</Text>
            </Box>
          ) : null}
          <Flex align="center" gap={2} mt={4}>
            {step > 0 ? (
              <Button variant="ghost" colorScheme="gray" onClick={() => setStep((s) => s - 1)}>{t("actions.back", { ns: "common" })}</Button>
            ) : null}
            <Spacer />
            {step < 4 ? (
              <Button colorScheme="brand" onClick={() => setStep((s) => s + 1)}>{t("actions.continue", { ns: "common" })}</Button>
            ) : (
              <Button type="submit" colorScheme="brand" isDisabled={pending || !form.field}>
                {pending ? "Saving…" : "Submit report"}
              </Button>
            )}
          </Flex>
        </CardBody>
      </Card>
    </Box>
  );
}
