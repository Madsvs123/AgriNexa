import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardBody, Divider, Stack, Text, Textarea } from "@chakra-ui/react";
import { farmsApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { FormField } from "@/components/ui/FormField";

export function NotesTab({ fieldId }: { fieldId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const notesQ = useQuery({
    queryKey: ["field-notes", { field: fieldId }],
    queryFn: () => farmsApi.notes({ field: fieldId }),
  });
  const addNote = useMutation({
    mutationFn: () => farmsApi.createNote({ field: fieldId, body }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["field-notes"] });
    },
  });

  const notes = notesQ.data?.results ?? [];

  return (
    <Card variant="surface" as="section">
      <CardBody>
        <FormField label="Add a note" htmlFor="fnote">
          <Textarea
            id="fnote"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Residue heavy on the east headland…"
          />
        </FormField>
        <Button
          colorScheme="brand"
          isDisabled={!body || addNote.isPending}
          onClick={() => addNote.mutate()}
        >
          {addNote.isPending ? "Posting…" : "Post note"}
        </Button>

        {notes.length ? (
          <>
            <Divider my={4} />
            <Stack spacing={3}>
              {notes.map((n) => (
                <Box key={n.id}>
                  <Text color="fg.muted" fontSize="sm">
                    {n.author_name} · {formatDateTime(n.created_at)}
                  </Text>
                  <Text>{n.body}</Text>
                </Box>
              ))}
            </Stack>
          </>
        ) : (
          <Text color="fg.muted" mt={4}>
            No notes on this field yet.
          </Text>
        )}
      </CardBody>
    </Card>
  );
}
