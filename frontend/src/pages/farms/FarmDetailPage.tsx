import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Link,
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
import { PageHeader, ErrorBanner, FormField, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge, EmptyState } from "@/components/ui/StatCard";
import { ConfirmDialog } from "@/components/ui/Modal";
import { MapView } from "@/components/ui/MapView";
import { StatCard } from "@/components/ui/StatCard";

export default function FarmDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const farmQ = useQuery({ queryKey: ["farm", id], queryFn: () => farmsApi.get(id), enabled: !!id });
  const fieldsQ = useQuery({ queryKey: ["fields", { farm: id }], queryFn: () => farmsApi.fields({ farm: id }) });
  const equipQ = useQuery({ queryKey: ["equipment", { farm: id }], queryFn: () => equipmentApi.list({ farm: id }) });
  const sensorsQ = useQuery({ queryKey: ["sensors", { farm: id }], queryFn: () => sensorsApi.list({ farm: id }) });
  const seasonsQ = useQuery({ queryKey: ["seasons"], queryFn: () => cropsApi.seasons() });
  const notesQ = useQuery({ queryKey: ["field-notes", { farm: id }], queryFn: () => farmsApi.notes({ farm: id }) });
  const accessQ = useQuery({ queryKey: ["farm-access", id], queryFn: () => tenancyApi.farmAccess(id), enabled: tab === "access" });

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
  if (farmQ.isLoading) {
    return (
      <Box>
        <SkeletonBlock rows={8} />
      </Box>
    );
  }
  if (!farm) {
    return (
      <Box>
        <ErrorBanner message={farmQ.error ? getApiError(farmQ.error) : "Farm not found."} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={farm.name}
        subtitle={`${farm.code} · ${farm.address || "No address"} · ${farm.timezone}`}
        crumbs={
          <>
            <Link as={RouterLink} to="/farms">
              Farms
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">{farm.name}</Text>
          </>
        }
        actions={
          <>
            <Button as={RouterLink} to={`/farms/${id}/edit`} variant="ghost" colorScheme="gray">
              Edit
            </Button>
            <Button colorScheme="red" onClick={() => setConfirm(true)}>
              Archive
            </Button>
          </>
        }
      />
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
        <StatCard label="Total acres" value={formatAcres(farm.total_acres)} />
        <StatCard label="Fields" value={fieldsQ.data?.count ?? "—"} />
        <StatCard label="Sensors" value={sensorsQ.data?.count ?? "—"} />
        <StatCard label="Region" value={farm.region?.name ?? "Unassigned"} />
      </SimpleGrid>
      <Flex gap={2} wrap="wrap" mb={4}>
        {["overview", "fields", "equipment", "sensors", "seasons", "notes", "access"].map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "solid" : "ghost"}
            colorScheme={tab === t ? "brand" : "gray"}
            textTransform="capitalize"
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </Flex>
      {tab === "overview" ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <Box
            bg="bg.surface"
            borderWidth="1px"
            borderColor="border.default"
            borderRadius="xl"
            minH="320px"
            overflow="hidden"
          >
            <MapView height="320px" fields={fieldsQ.data?.results ?? []} sensors={sensorsQ.data?.results ?? []} />
          </Box>
          <Card variant="outline" borderColor="border.default" bg="bg.surface">
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
      ) : null}
      {tab === "fields" ? (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {(fieldsQ.data?.results ?? []).map((f) => (
            <Card
              key={f.id}
              as={RouterLink}
              to={`/fields/${f.id}`}
              variant="outline"
              borderColor="border.default"
              bg="bg.surface"
              _hover={{ borderColor: "brand.300" }}
            >
              <CardBody>
                <Text fontWeight="semibold">{f.name}</Text>
                <Text color="fg.muted">
                  {formatAcres(f.acres)} · {f.soil_type || "Soil unknown"}
                </Text>
                <Box mt={2}>
                  <StatusBadge status={f.health_status} />
                </Box>
              </CardBody>
            </Card>
          ))}
          {!fieldsQ.data?.results.length ? (
            <EmptyState title="No fields on this farm" body="Split North 80 or South Bottom into managed fields." />
          ) : null}
        </SimpleGrid>
      ) : null}
      {tab === "equipment" ? (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {(equipQ.data?.results ?? []).map((e) => (
            <Card
              key={e.id}
              as={RouterLink}
              to={`/equipment/${e.id}`}
              variant="outline"
              borderColor="border.default"
              bg="bg.surface"
              _hover={{ borderColor: "brand.300" }}
            >
              <CardBody>
                <Text fontWeight="semibold">{e.name}</Text>
                <Text color="fg.muted" mb={2}>
                  {e.make} {e.model} · {e.hours} hrs
                </Text>
                <StatusBadge status={e.status} />
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      ) : null}
      {tab === "sensors" ? (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {(sensorsQ.data?.results ?? []).map((s) => (
            <Card
              key={s.id}
              as={RouterLink}
              to={`/sensors/${s.id}`}
              variant="outline"
              borderColor="border.default"
              bg="bg.surface"
              _hover={{ borderColor: "brand.300" }}
            >
              <CardBody>
                <Text fontWeight="semibold">{s.name}</Text>
                <Text color="fg.muted" mb={2}>
                  {s.sensor_type_name}
                </Text>
                <StatusBadge status={s.status} />
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      ) : null}
      {tab === "seasons" ? (
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
                  <Td>{s.is_active ? <StatusBadge status="healthy" label="Active" /> : <StatusBadge status="idle" />}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      ) : null}
      {tab === "notes" ? (
        <Card variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <FormField label="Field note" htmlFor="note">
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tile outlet running clear on South Bottom…"
              />
            </FormField>
            <Button colorScheme="brand" isDisabled={!note || addNote.isPending} onClick={() => addNote.mutate()}>
              Save note
            </Button>
            <Stack spacing={3} mt={4}>
              {(notesQ.data?.results ?? []).map((n) => (
                <Box key={n.id}>
                  <Text color="fg.muted">
                    {n.author_name} · {formatDateTime(n.created_at)}
                  </Text>
                  <Text>{n.body}</Text>
                </Box>
              ))}
            </Stack>
          </CardBody>
        </Card>
      ) : null}
      {tab === "access" ? (
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
      ) : null}
      <ConfirmDialog
        open={confirm}
        title="Archive this farm?"
        body="Fields, sensors, and history stay in the database but the farm leaves the active list."
        confirmLabel="Archive farm"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
      />
    </Box>
  );
}
