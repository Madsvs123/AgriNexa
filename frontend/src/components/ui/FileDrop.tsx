import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Flex, Text, VisuallyHiddenInput } from "@chakra-ui/react";
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
    <Flex
      direction="column"
      align="center"
      gap={1}
      p={8}
      borderWidth="2px"
      borderStyle="dashed"
      borderColor={over ? "brand.500" : "border.default"}
      borderRadius="xl"
      bg={over ? "brand.50" : "bg.subtle"}
      _dark={{ bg: over ? "whiteAlpha.200" : "whiteAlpha.100" }}
      cursor="pointer"
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
      <Text fontWeight="semibold">{label}</Text>
      <Text fontSize="sm" color="fg.muted">
        {hint}
      </Text>
      <VisuallyHiddenInput ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={onChange} />
    </Flex>
  );
}
