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
        error={farmQ.error ? getApiError(farmQ.error) : !farm && !farmQ.isLoading ? "Farm not found." : null}
        title={farm?.name ?? "Farm"}
        subtitle={farm ? `${farm.code} · ${farm.address || "No address"} · ${farm.timezone}` : undefined}
        actions={
          farm ? (
            <>
              <Button as={RouterLink} to={`/farms/${id}/edit`} variant="ghost" colorScheme="gray" size="sm">
                Edit
              </Button>
              <Button colorScheme="red" size="sm" onClick={() => setConfirm(true)}>
                Archive
              </Button>
            </>
          ) : null
        }
        kpis={
          farm
            ? [
                <StatCard key="acres" label="Total acres" value={formatAcres(farm.total_acres)} />,
                <StatCard key="fields" label="Fields" value={fieldsQ.data?.count ?? "—"} />,
                <StatCard key="sensors" label="Sensors" value={sensorsQ.data?.count ?? "—"} />,
                <StatCard key="region" label="Region" value={farm.region?.name ?? "Unassigned"} />,
              ]
            : undefined
        }
        tabs={
          farm
            ? [
                {
                  id: "overview",
                  label: "Overview",
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
                            Location
                          </Heading>
                          <Text>
                            {farm.lat != null && farm.lng != null
                              ? `${farm.lat.toFixed(4)}, ${farm.lng.toFixed(4)}`
                              : "Drop a pin when you edit this farm."}
                          </Text>
                          <Text color="fg.muted" mt={2}>
                            Timezone {farm.timezone}. Use the map to inspect field boundaries.
                          </Text>
                        </CardBody>
                      </Card>
                    </SimpleGrid>
                  ),
                },
                {
                  id: "fields",
                  label: `Fields${fieldsQ.data?.count ? ` (${fieldsQ.data.count})` : ""}`,
                  render: () => (
                    <RecordGrid
                      rows={fieldsQ.data?.results ?? []}
                      to={(f) => `/fields/${f.id}`}
                      title="No fields on this farm"
                      body="Split North 80 or South Bottom into managed fields."
                      render={(f) => (
                        <>
                          <Text fontWeight="semibold">{f.name}</Text>
                          <Text color="fg.muted" fontSize="sm">
                            {formatAcres(f.acres)} · {f.soil_type || "Soil unknown"}
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
                  label: "Equipment",
                  render: () => (
                    <RecordGrid
                      rows={equipQ.data?.results ?? []}
                      to={(e) => `/equipment/${e.id}`}
                      title="No equipment assigned"
                      body="Assign a tractor or planter to this farm to track hours and fuel."
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
                  label: "Sensors",
                  render: () => (
                    <RecordGrid
                      rows={sensorsQ.data?.results ?? []}
                      to={(s) => `/sensors/${s.id}`}
                      title="No sensors on this farm"
                      body="Pair a soil probe to start streaming moisture readings."
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
                  label: "Seasons",
                  render: () => (
                    <TableContainer bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl">
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Season</Th>
                            <Th>Start</Th>
                            <Th>End</Th>
                            <Th>Status</Th>
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
                                  <StatusBadge status="healthy" label="Active" />
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
                  label: "Notes",
                  render: () => (
                    <Card variant="surface">
                      <CardBody>
                        <FormField label="Field note" htmlFor="note">
                          <Textarea
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Tile outlet running clear on South Bottom…"
                          />
                        </FormField>
                        <Button
                          colorScheme="brand"
                          isDisabled={!note || addNote.isPending}
                          onClick={() => addNote.mutate()}
                        >
                          Save note
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
                  label: "Access",
                  render: () => (
                    <TableContainer bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl">
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Member</Th>
                            <Th>View</Th>
                            <Th>Edit</Th>
                            <Th>Manage</Th>
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
                        Update the matrix in Settings → Farm access.
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
        title="Archive this farm?"
        body="Fields, sensors, and history stay in the database but the farm leaves the active list."
        confirmLabel="Archive farm"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
