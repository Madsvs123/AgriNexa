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
    <Box>
      <PageHeader
        title="New scout report"
        subtitle="Five-step walk: field, health, findings, photos, submit."
        crumbs={
          <>
            <Link as={RouterLink} to="/scouting">
              Scouting
            </Link>
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
            <FormField label="Field" htmlFor="sfield">
              <Select id="sfield" isRequired value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
                <option value="">Select field</option>
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
              <FormField label="Canopy health (1–10)" htmlFor="health">
                <Input
                  id="health"
                  type="number"
                  min={1}
                  max={10}
                  value={form.health_score}
                  onChange={(e) => setForm({ ...form, health_score: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="Overall severity" htmlFor="sev">
                <Select
                  id="sev"
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as typeof form.severity })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </FormField>
              <SeverityMeter value={form.severity} />
              <FormField label="Notes" htmlFor="snotes">
                <Textarea id="snotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Uneven stand on the west headland…" />
              </FormField>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <FormField label="Diseases" htmlFor="dis" hint="Comma-separated, e.g. Gray leaf spot, Northern corn leaf blight">
                <Input id="dis" value={form.diseases} onChange={(e) => setForm({ ...form, diseases: e.target.value })} />
              </FormField>
              <FormField label="Pests" htmlFor="pests" hint="e.g. Corn rootworm, Japanese beetle">
                <Input id="pests" value={form.pests} onChange={(e) => setForm({ ...form, pests: e.target.value })} />
              </FormField>
              <FormField label="Weeds" htmlFor="weeds" hint="e.g. Waterhemp, Foxtail">
                <Input id="weeds" value={form.weeds} onChange={(e) => setForm({ ...form, weeds: e.target.value })} />
              </FormField>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <FileDrop accept="image/*" multiple onFiles={setFiles} label="Drop canopy or pest photos" />
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
              <Button variant="ghost" colorScheme="gray" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : null}
            <Spacer />
            {step < 4 ? (
              <Button colorScheme="brand" onClick={() => setStep((s) => s + 1)}>
                Continue
              </Button>
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
