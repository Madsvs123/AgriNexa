import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { farmsApi, getApiError, platformApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";
import { FileDrop } from "@/components/ui/FileDrop";
import { Drawer } from "@/components/ui/Modal";

export default function DocumentsPage() {
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
    <div className="page">
      <PageHeader
        title="Documents"
        subtitle="Contracts, soil tests, and insurance PDFs tied to a farm."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Upload
          </button>
        }
      />
      <ErrorBanner message={docsQ.error ? getApiError(docsQ.error) : null} />
      <div className="card">
        <DataTable
          rows={docsQ.data?.results ?? []}
          rowKey={(d) => d.id}
          emptyTitle="No documents"
          emptyBody="Drop a soil test PDF or cash-rent contract to file it against North Ridge."
          columns={[
            { key: "title", header: "Title" },
            { key: "category", header: "Category" },
            { key: "farm_name", header: "Farm", render: (d) => d.farm_name ?? "—" },
            { key: "uploaded_at", header: "Uploaded", render: (d) => formatDateTime(d.uploaded_at) },
            {
              key: "file",
              header: "File",
              render: (d) =>
                d.file ? (
                  <a href={d.file} target="_blank" rel="noreferrer">
                    Open
                  </a>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </div>
      <Drawer open={open} title="Upload document" onClose={() => setOpen(false)}>
        <FormField label="Title" htmlFor="dtitle">
          <input id="dtitle" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Category" htmlFor="dcat">
          <select id="dcat" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="contract">Contract</option>
            <option value="soil_test">Soil test</option>
            <option value="insurance">Insurance</option>
            <option value="permit">Permit</option>
            <option value="other">Other</option>
          </select>
        </FormField>
        <FormField label="Farm" htmlFor="dfarm">
          <select id="dfarm" className="select" value={farm} onChange={(e) => setFarm(e.target.value)}>
            <option value="">Organization-wide</option>
            {(farmsQ.data?.results ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </FormField>
        <FileDrop onFiles={(files) => setFile(files[0] ?? null)} />
        {file ? <p className="muted">{file.name}</p> : null}
        <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} disabled={!file || !title || upload.isPending} onClick={() => upload.mutate()}>
          Upload
        </button>
      </Drawer>
    </div>
  );
}
