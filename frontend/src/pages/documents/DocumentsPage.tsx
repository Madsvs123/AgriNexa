import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Input, Link, Select, Text } from "@chakra-ui/react";
import { farmsApi, getApiError, platformApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { FileDrop } from "@/components/ui/FileDrop";
import { Drawer } from "@/components/ui/Modal";
import { useTranslation } from "react-i18next";

export default function DocumentsPage() {
  const { t } = useTranslation("insights");
  const qc = useQueryClient();
  const docsQ = useQuery({ queryKey: ["documents"], queryFn: () => platformApi.documents() });
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("contract");
  const [farm, setFarm] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("category", category);
      if (farm) fd.append("farm", farm);
      if (file) fd.append("file", file);
      return platformApi.uploadDocument(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      setOpen(false);
      setTitle("");
      setFile(null);
    },
  });

  return (
    <Box>
      <PageHeader
        title={t("documents.title")}
        subtitle={t("documents.subtitle")}
        actions={
          <Button colorScheme="brand" onClick={() => setOpen(true)}>
            Upload
          </Button>
        }
      />
      <ErrorBanner message={docsQ.error ? getApiError(docsQ.error) : null} />
      <DataTable
        rows={docsQ.data?.results ?? []}
        rowKey={(d) => d.id}
        emptyTitle={t("documents.emptyTitle")}
        emptyBody={t("documents.emptyBody")}
        columns={[
          { key: "title", header: t("documents.docTitle") },
          { key: "category", header: t("documents.category") },
          { key: "farm_name", header: t("labels.farm", { ns: "common" }), render: (d) => d.farm_name ?? "—" },
          { key: "uploaded_at", header: t("documents.uploaded"), render: (d) => formatDateTime(d.uploaded_at) },
          {
            key: "file",
            header: t("documents.file"),
            render: (d) =>
              d.file ? (
                <Link href={d.file} target="_blank" rel="noreferrer" color="brand.500">
                  Open
                </Link>
              ) : (
                "—"
              ),
          },
        ]}
      />
      <Drawer open={open} title={t("documents.upload")} onClose={() => setOpen(false)}>
        <FormField label={t("documents.docTitle")} htmlFor="dtitle">
          <Input id="dtitle" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label={t("documents.category")} htmlFor="dcat">
          <Select id="dcat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="contract">{t("documents.contract")}</option>
            <option value="soil_test">{t("documents.soilTest")}</option>
            <option value="insurance">{t("documents.insurance")}</option>
            <option value="permit">{t("documents.permit")}</option>
            <option value="other">{t("documents.other")}</option>
          </Select>
        </FormField>
        <FormField label={t("labels.farm", { ns: "common" })} htmlFor="dfarm">
          <Select id="dfarm" value={farm} onChange={(e) => setFarm(e.target.value)}>
            <option value="">{t("documents.orgWide")}</option>
            {(farmsQ.data?.results ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FileDrop onFiles={(files) => setFile(files[0] ?? null)} />
        {file ? (
          <Text color="fg.muted" mt={2}>
            {file.name}
          </Text>
        ) : null}
        <Button
          colorScheme="brand"
          mt={3}
          isDisabled={!file || !title || upload.isPending}
          onClick={() => upload.mutate()}
        >
          Upload
        </Button>
      </Drawer>
    </Box>
  );
}
