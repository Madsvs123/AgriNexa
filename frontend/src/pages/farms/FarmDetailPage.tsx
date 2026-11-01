import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { equipmentApi, farmsApi, getApiError, sensorsApi, cropsApi, tenancyApi } from "@/api/client";
import { formatAcres, formatDate, formatDateTime } from "@/lib/utils";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge, EmptyState, StatCard } from "@/components/ui/StatCard";
import { ConfirmDialog } from "@/components/ui/Modal";
import { MapView } from "@/components/ui/MapView";
import { DetailPage } from "@/components/templates/DetailPage";
import { useTranslation } from "react-i18next";
import { usePlanningLabels } from "@/lib/usePlanningLabels";

function RecordGrid<T extends { id: string }>({
  rows,
  to,
  title,
  body,
  render,
}: {
  rows: T[];
  to: (row: T) => string;
  title: string;
  body: string;
  render: (row: T) => React.ReactNode;
}) {
  if (!rows.length) return <EmptyState title={title} body={body} />;
  return (
    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
      {rows.map((row) => (
        <Card
          key={row.id}
          as={RouterLink}
          to={to(row)}
          variant="surface"
          _hover={{ borderColor: "brand.300", textDecoration: "none" }}
          transition="border-color 0.15s"
        >
          <CardBody>{render(row)}</CardBody>
        </Card>
      ))}
    </SimpleGrid>
  );
}

export default function FarmDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation("land");
  const labels = usePlanningLabels();
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");

  const farmQ = useQuery({ queryKey: ["farm", id], queryFn: () => farmsApi.get(id), enabled: !!id });
  const fieldsQ = useQuery({ queryKey: ["fields", { farm: id }], queryFn: () => farmsApi.fields({ farm: id }) });
  const equipQ = useQuery({ queryKey: ["equipment", { farm: id }], queryFn: () => equipmentApi.list({ farm: id }) });
  const sensorsQ = useQuery({ queryKey: ["sensors", { farm: id }], queryFn: () => sensorsApi.list({ farm: id }) });
  const seasonsQ = useQuery({ queryKey: ["seasons"], queryFn: () => cropsApi.seasons() });
  const notesQ = useQuery({ queryKey: ["field-notes", { farm: id }], queryFn: () => farmsApi.notes({ farm: id }) });
  const accessQ = useQuery({
    queryKey: ["farm-access", id],
    queryFn: () => tenancyApi.farmAccess(id),
    enabled: !!id,
  });

  const remove = useMutation({
    mutationFn: () => farmsApi.remove(id),
    onSuccess: () => navigate("/farms"),
  });
  const addNote = useMutation({
    mutationFn: () => farmsApi.createNote({ body: note, field: fieldsQ.data?.results[0]?.id }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["field-notes"] });
    },
  });

  const farm = farmQ.data;

  return (
    <>
      <DetailPage
        loading={farmQ.isLoading}
        error={farmQ.error ? getApiError(farmQ.error) : !farm && !farmQ.isLoading ? t("farmDetail.notFound") : null}
        title={farm?.name ?? "Farm"}
        subtitle={farm ? `${farm.code} · ${farm.address || "No address"} · ${farm.timezone}` : undefined}
        actions={
          farm ? (
            <>
              <Button as={RouterLink} to={`/farms/${id}/edit`} variant="ghost" colorScheme="gray" size="sm">
                {t("actions.edit", { ns: "common" })}
              </Button>
              <Button colorScheme="red" size="sm" onClick={() => setConfirm(true)}>
                {t("farmDetail.archiveFarm")}
              </Button>
            </>
          ) : null
        }
        kpis={
          farm
            ? [
                <StatCard key="acres" label={t("farmDetail.totalAcres")} value={formatAcres(farm.total_acres)} />,
                <StatCard key="fields" label={t("farmDetail.fields")} value={fieldsQ.data?.count ?? "—"} />,
                <StatCard key="sensors" label={t("farmDetail.sensors")} value={sensorsQ.data?.count ?? "—"} />,
                <StatCard key="region" label={t("farmDetail.region")} value={farm.region?.name ?? "Unassigned"} />,
              ]
            : undefined
        }
        tabs={
          farm
            ? [
                {
                  id: "overview",
                  label: t("farmDetail.tabs.overview"),
                  render: () => (
                    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                      <Box
                        bg="bg.surface"
                        borderWidth="1px"
                        borderColor="border.default"
                        borderRadius="xl"
                        minH="320px"
                        overflow="hidden"
                      >
                        <MapView
                          height="320px"
                          fields={fieldsQ.data?.results ?? []}
                          sensors={sensorsQ.data?.results ?? []}
                        />
                      </Box>
                      <Card variant="surface">
                        <CardBody>
                          <Heading size="sm" mb={2}>
                            {t("farmDetail.location")}
                          </Heading>
                          <Text>
                            {farm.lat != null && farm.lng != null
                              ? `${farm.lat.toFixed(4)}, ${farm.lng.toFixed(4)}`
                              : t("farmDetail.dropPin")}
                          </Text>
                          <Text color="fg.muted" mt={2}>
                            {t("farmDetail.timezoneHint", { timezone: farm.timezone })}
                          </Text>
                        </CardBody>
                      </Card>
                    </SimpleGrid>
                  ),
                },
                {
                  id: "fields",
                  label: `${t("farmDetail.tabs.fields")}${fieldsQ.data?.count ? ` (${fieldsQ.data.count})` : ""}`,
                  render: () => (
                    <RecordGrid
                      rows={fieldsQ.data?.results ?? []}
                      to={(f) => `/fields/${f.id}`}
                      title={t("farmDetail.noFieldsTitle")}
                      body={t("farmDetail.noFieldsBody")}
                      render={(f) => (
                        <>
                          <Text fontWeight="semibold">{f.name}</Text>
                          <Text color="fg.muted" fontSize="sm">
                            {formatAcres(f.acres)} · {f.soil_type ? labels.soil(f.soil_type) : t("fieldDetail.soilUnknown")}
                          </Text>
                          <Box mt={2}>
                            <StatusBadge status={f.health_status} />
                          </Box>
                        </>
                      )}
                    />
                  ),
                },
                {
                  id: "equipment",
                  label: t("farmDetail.tabs.equipment"),
                  render: () => (
                    <RecordGrid
                      rows={equipQ.data?.results ?? []}
                      to={(e) => `/equipment/${e.id}`}
                      title={t("farmDetail.noEquipmentTitle")}
                      body={t("farmDetail.noEquipmentBody")}
                      render={(e) => (
                        <>
                          <Text fontWeight="semibold">{e.name}</Text>
                          <Text color="fg.muted" fontSize="sm" mb={2}>
                            {e.make} {e.model} · {e.hours} hrs
                          </Text>
                          <StatusBadge status={e.status} />
                        </>
                      )}
                    />
                  ),
                },
                {
                  id: "sensors",
                  label: t("farmDetail.tabs.sensors"),
                  render: () => (
                    <RecordGrid
                      rows={sensorsQ.data?.results ?? []}
                      to={(s) => `/sensors/${s.id}`}
                      title={t("farmDetail.noSensorsTitle")}
                      body={t("farmDetail.noSensorsBody")}
                      render={(s) => (
                        <>
                          <Text fontWeight="semibold">{s.name}</Text>
                          <Text color="fg.muted" fontSize="sm" mb={2}>
                            {s.sensor_type_name}
                          </Text>
                          <StatusBadge status={s.status} />
                        </>
                      )}
                    />
                  ),
                },
                {
                  id: "seasons",
                  label: t("farmDetail.tabs.seasons"),
                  render: () => (
                    <TableContainer bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl">
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>{t("farmDetail.season")}</Th>
                            <Th>{t("farmDetail.start")}</Th>
                            <Th>{t("fieldForm.harvestDate")}</Th>
                            <Th>{t("labels.status", { ns: "common" })}</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {(seasonsQ.data?.results ?? []).map((s) => (
                            <Tr key={s.id}>
                              <Td>{s.name}</Td>
                              <Td>{formatDate(s.start_date)}</Td>
                              <Td>{formatDate(s.end_date)}</Td>
                              <Td>
                                {s.is_active ? (
                                  <StatusBadge status="healthy" label={t("farmDetail.active")} />
                                ) : (
                                  <StatusBadge status="idle" />
                                )}
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  ),
                },
                {
                  id: "notes",
                  label: t("farmDetail.tabs.notes"),
                  render: () => (
                    <Card variant="surface">
                      <CardBody>
                        <FormField label={t("farmDetail.fieldNote")} htmlFor="note">
                          <Textarea
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={t("farmDetail.notePlaceholder")}
                          />
                        </FormField>
                        <Button
                          colorScheme="brand"
                          isDisabled={!note || addNote.isPending}
                          onClick={() => addNote.mutate()}
                        >
                          {t("actions.save", { ns: "common" })}
                        </Button>
                        <Stack spacing={3} mt={4}>
                          {(notesQ.data?.results ?? []).map((n) => (
                            <Box key={n.id}>
                              <Text color="fg.muted" fontSize="sm">
                                {n.author_name} · {formatDateTime(n.created_at)}
                              </Text>
                              <Text>{n.body}</Text>
                            </Box>
                          ))}
                        </Stack>
                      </CardBody>
                    </Card>
                  ),
                },
                {
                  id: "access",
                  label: t("farmDetail.tabs.access"),
                  render: () => (
                    <TableContainer bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl">
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>{t("farmDetail.member")}</Th>
                            <Th>{t("farmDetail.view")}</Th>
                            <Th>{t("farmDetail.edit")}</Th>
                            <Th>{t("farmDetail.manage")}</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {(accessQ.data ?? []).map((a) => (
                            <Tr key={a.user_id}>
                              <Td>{a.user_name || a.user_email}</Td>
                              <Td>{a.can_view ? "Yes" : "No"}</Td>
                              <Td>{a.can_edit ? "Yes" : "No"}</Td>
                              <Td>{a.can_manage ? "Yes" : "No"}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                      <Text color="fg.muted" p="14px">
                        {t("farmDetail.accessHint")}
                      </Text>
                    </TableContainer>
                  ),
                },
              ]
            : []
        }
      />
      <ConfirmDialog
        open={confirm}
        title={t("farmDetail.archiveTitle")}
        body={t("farmDetail.archiveBody")}
        confirmLabel={t("farmDetail.archiveFarm")}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
