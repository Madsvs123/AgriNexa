import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Flex,
  Heading,
  SimpleGrid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { Star } from "lucide-react";
import { cropsApi, getApiError } from "@/api/client";
import { ListPage } from "@/components/templates/ListPage";
import { ChartCard, EmptyState } from "@/components/ui/StatCard";
import { ConstraintBars } from "@/components/planning/ConstraintBars";
import { useScope } from "@/hooks/useScope";
import { fallbackColor, riskScheme } from "@/lib/planning";
import { formatNumber } from "@/lib/utils";
import { ChartFrame } from "@/components/ui/ChartFrame";
import { formatCurrency, formatDelta } from "@/i18n/format";

const MONEY_KEYS = new Set(["totals.revenue", "totals.total_cost", "totals.margin", "totals.margin_per_acre"]);

function fmtValue(key: string, v: number | null) {
  if (v == null) return "—";
  if (MONEY_KEYS.has(key)) return formatCurrency(v);
  if (key === "diversity_index") return v.toFixed(2);
  return formatNumber(v, key.includes("score") || key.includes("violations") ? 0 : 0);
}

export default function StrategyComparePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ids = useMemo(() => (params.get("ids") ?? "").split(",").filter(Boolean), [params]);
  const { params: scopeParams } = useScope();

  const listQ = useQuery({
    queryKey: ["strategies", "compare-picker", scopeParams],
    queryFn: () =>
      cropsApi.strategies({
        ...(scopeParams.farm ? { farm: scopeParams.farm } : {}),
        ...(scopeParams.season_id ? { season: scopeParams.season_id } : {}),
      }),
  });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => cropsApi.crops() });
  const cmpQ = useQuery({
    queryKey: ["strategy-compare", ids],
    queryFn: () => cropsApi.compareStrategies(ids),
    enabled: ids.length > 0,
  });
  const [picker, setPicker] = useState<string[]>(ids);

  const cmp = cmpQ.data;
  const colorOf = (name: string) => cropsQ.data?.results.find((c) => c.name === name)?.color_hex ?? fallbackColor(name);

  const mixData = useMemo(() => {
    if (!cmp) return { rows: [], crops: [] as string[] };
    const cropNames = Array.from(new Set(cmp.crop_mix.flatMap((m) => Object.keys(m.crop_acres))));
    return {
      rows: cmp.crop_mix.map((m) => ({ name: m.name, ...m.crop_acres })),
      crops: cropNames,
    };
  }, [cmp]);

  const picking = ids.length === 0;

  return (
    <ListPage
      title="Compare strategies"
      subtitle="Side-by-side economics, resources, rotation fit, and risk. Deltas are against the baseline."
      error={cmpQ.error ? getApiError(cmpQ.error) : listQ.error ? getApiError(listQ.error) : null}
      loading={!picking && cmpQ.isLoading}
      actions={
        <>
          {!picking ? (
            <Button variant="outline" colorScheme="gray" onClick={() => setParams({})}>
              Change selection
            </Button>
          ) : null}
          <Button as={RouterLink} to="/crops/strategies" variant="ghost" colorScheme="gray">
            All strategies
          </Button>
        </>
      }
    >
      {picking ? (
        <Card variant="surface">
          <CardBody>
            <Heading size="sm" mb={3}>Pick strategies to compare</Heading>
            <Stack spacing={2} mb={4}>
              {(listQ.data?.results ?? []).map((s) => (
                <Checkbox key={s.id} colorScheme="brand" isChecked={picker.includes(s.id)} onChange={(e) => setPicker((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}>
                  <Text as="span" fontWeight="semibold">{s.name}</Text>{" "}
                  <Text as="span" color="fg.muted" fontSize="sm">
                    {s.farm_name} · {s.season_name} · {s.status}
                    {s.is_baseline ? " · baseline" : ""}
                    {s.summary?.margin != null ? ` · ${formatCurrency(s.summary.margin)}` : ""}
                  </Text>
                </Checkbox>
              ))}
              {!listQ.data?.results.length ? <EmptyState title="No strategies in scope" body="Create strategies for this farm and season first." /> : null}
            </Stack>
            <Button colorScheme="brand" isDisabled={picker.length < 2} onClick={() => setParams({ ids: picker.join(",") })}>
              Compare {picker.length ? `(${picker.length})` : ""}
            </Button>
          </CardBody>
        </Card>
      ) : cmp ? (
        <Stack spacing={4}>
          {/* Ranking */}
          <SimpleGrid columns={{ base: 1, md: Math.min(cmp.strategies.length, 4) }} spacing={3}>
            {cmp.ranking.map((r, rank) => {
              const e = cmp.strategies[r.index];
              return (
                <Card key={r.strategy_id} variant={rank === 0 ? "inset" : "surface"} as="button" textAlign="start" onClick={() => navigate(`/crops/strategies/${r.strategy_id}`)} _hover={{ borderColor: "brand.300" }}>
                  <CardBody>
                    <Flex align="center" gap={2} mb={1}>
                      <Badge colorScheme={rank === 0 ? "brand" : "gray"}>#{rank + 1}</Badge>
                      {e.is_baseline ? <Box color="wheat.500"><Star size={13} fill="currentColor" /></Box> : null}
                      <Text fontWeight="semibold" noOfLines={1}>{e.name}</Text>
                    </Flex>
                    <Text fontSize="sm" color="fg.muted">
                      {formatCurrency(e.totals.margin)} margin · {formatCurrency(e.totals.margin_per_acre)}/ac
                    </Text>
                    <Flex gap={2} mt={2} wrap="wrap">
                      <Badge colorScheme={riskScheme(e.risk_score)}>risk {e.risk_score}</Badge>
                      <Badge colorScheme={e.feasible ? "green" : "red"}>{e.feasible ? "feasible" : `${e.hard_violations} violation${e.hard_violations === 1 ? "" : "s"}`}</Badge>
                      <Badge variant="outline" textTransform="capitalize">{e.assumptions.rainfall_scenario}</Badge>
                    </Flex>
                  </CardBody>
                </Card>
              );
            })}
          </SimpleGrid>

          {/* Matrix */}
          <Card variant="surface">
            <CardBody px={0} py={0}>
              <TableContainer>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Metric</Th>
                      {cmp.strategies.map((e) => (
                        <Th key={e.strategy_id} isNumeric>
                          <Flex justify="flex-end" align="center" gap={1}>
                            {e.is_baseline ? <Box color="wheat.500"><Star size={11} fill="currentColor" /></Box> : null}
                            {e.name}
                          </Flex>
                        </Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {cmp.metrics.map((m) => (
                      <Tr key={m.key}>
                        <Td>
                          <Text fontWeight="semibold">{m.label}</Text>
                          <Text fontSize="10px" color="fg.muted">{m.higher_is_better ? "higher is better" : "lower is better"}</Text>
                        </Td>
                        {m.values.map((v, i) => {
                          const best = m.best_index === i && cmp.strategies.length > 1;
                          const d = m.deltas[i];
                          const isBaseline = cmp.strategies[i].strategy_id === cmp.baseline_id;
                          const good = d != null && d !== 0 ? (m.higher_is_better ? d > 0 : d < 0) : null;
                          return (
                            <Td key={i} isNumeric bg={best ? "brand.50" : undefined} _dark={{ bg: best ? "whiteAlpha.100" : undefined }}>
                              <Text fontWeight={best ? "bold" : "normal"}>{fmtValue(m.key, v)}</Text>
                              {!isBaseline && d != null ? (
                                <Text fontSize="xs" color={good == null ? "fg.muted" : good ? "green.600" : "red.500"}>
                                  {formatDelta(d, { currency: MONEY_KEYS.has(m.key) ? "USD" : undefined, digits: m.key === "diversity_index" ? 2 : 0 })}
                                </Text>
                              ) : isBaseline && cmp.strategies.length > 1 ? (
                                <Text fontSize="xs" color="fg.muted">baseline</Text>
                              ) : null}
                            </Td>
                          );
                        })}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </CardBody>
          </Card>

          <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
            <ChartCard title="Crop mix (acres)">
              <ChartFrame height="260px">
                <BarChart data={mixData.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {mixData.crops.map((c) => (
                    <Bar key={c} dataKey={c} stackId="mix" fill={colorOf(c)} />
                  ))}
                </BarChart>
                </ChartFrame>
            </ChartCard>
            <ChartCard title="Revenue, cost, margin">
              <ChartFrame height="260px">
                <BarChart data={cmp.strategies.map((e) => ({ name: e.name, Revenue: e.totals.revenue, Cost: e.totals.total_cost, Margin: e.totals.margin }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="Revenue" fill="#3D7EA6" />
                  <Bar dataKey="Cost" fill="#D4A017" />
                  <Bar dataKey="Margin" fill="#2F6F4E" />
                </BarChart>
                </ChartFrame>
            </ChartCard>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: Math.min(cmp.strategies.length, 3) }} spacing={4}>
            {cmp.strategies.map((e) => (
              <Card key={e.strategy_id} variant="surface">
                <CardBody>
                  <Heading size="xs" mb={3}>{e.name} · constraints</Heading>
                  <ConstraintBars results={e.constraints} compact />
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      ) : null}
    </ListPage>
  );
}
