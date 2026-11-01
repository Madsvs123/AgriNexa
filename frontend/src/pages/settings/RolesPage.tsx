import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Flex,
  Heading,
  Input,
  Spacer,
  Stack,
  Tag,
  Text,
} from "@chakra-ui/react";
import { getApiError, tenancyApi } from "@/api/client";
import { PageHeader, ErrorBanner, FormField } from "@/components/ui/FormField";
import { Drawer } from "@/components/ui/Modal";
import { ROLE_PERMISSIONS } from "@/types";

export default function RolesPage() {
  const qc = useQueryClient();
  const { t } = useTranslation("settings");
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => tenancyApi.roles() });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      editing
        ? tenancyApi.patchRole(editing, { name, description, permissions: perms })
        : tenancyApi.createRole({ name, description, permissions: perms }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false);
      setEditing(null);
    },
  });

  const toggle = (key: string) =>
    setPerms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));

  return (
    <Box>
      <PageHeader
        title={t("roles.title")}
        subtitle={t("roles.subtitle")}
        actions={
          <Button
            colorScheme="brand"
            onClick={() => {
              setEditing(null);
              setName("");
              setDescription("");
              setPerms([]);
              setOpen(true);
            }}
          >{t("roles.newRole")}</Button>
        }
      />
      <ErrorBanner message={rolesQ.error ? getApiError(rolesQ.error) : null} />
      <Stack spacing={4}>
        {(rolesQ.data?.results ?? []).map((r) => (
          <Card key={r.id} as="article" variant="outline" borderColor="border.default" bg="bg.surface">
            <CardBody>
              <Flex align="center" gap={2}>
                <Heading size="sm">{r.name}</Heading>
                <Spacer />
                <Button
                  variant="ghost"
                  colorScheme="gray"
                  size="sm"
                  onClick={() => {
                    setEditing(r.id);
                    setName(r.name);
                    setDescription(r.description);
                    setPerms(r.permissions ?? []);
                    setOpen(true);
                  }}
                >{t("actions.edit", { ns: "common" })}</Button>
              </Flex>
              <Text color="fg.muted" mt={1}>
                {r.description}
              </Text>
              <Flex align="center" gap={2} wrap="wrap" mt={2}>
                {(r.permissions ?? []).map((p) => (
                  <Tag key={p} size="sm" colorScheme="gray" variant="subtle">
                    {p}
                  </Tag>
                ))}
              </Flex>
            </CardBody>
          </Card>
        ))}
      </Stack>
      <Drawer open={open} title={editing ? "Edit role" : "New role"} onClose={() => setOpen(false)} wide>
        <FormField label={t("roles.name")} htmlFor="rname">
          <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label={t("roles.description")} htmlFor="rdesc">
          <Input id="rdesc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <Box as="fieldset">
          <Text as="legend" fontWeight="medium" mb={1}>{t("roles.permissions")}</Text>
          <Stack spacing={1}>
            {ROLE_PERMISSIONS.map((p) => (
              <Checkbox key={p.key} isChecked={perms.includes(p.key)} onChange={() => toggle(p.key)} py={1}>
                {p.label}{" "}
                <Text as="span" color="fg.muted">
                  ({p.key})
                </Text>
              </Checkbox>
            ))}
          </Stack>
        </Box>
        <Button colorScheme="brand" mt={3} isDisabled={save.isPending} onClick={() => save.mutate()}>{t("roles.saveRole")}</Button>
      </Drawer>
    </Box>
  );
}
