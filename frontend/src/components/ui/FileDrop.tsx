import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload } from "lucide-react";

export function FileDrop({
  label = "Drop files or click to browse",
  hint = "PDF, images, or spreadsheets up to 25 MB",
  accept,
  multiple,
  onFiles,
}: {
  label?: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => take(e.target.files);

  return (
    <div
      className={over ? "dropzone over" : "dropzone"}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <Upload size={22} />
      <p>
        <strong>{label}</strong>
      </p>
      <p className="hint">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
      />
    </div>
  );
}
