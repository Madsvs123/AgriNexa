import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Card,
  CardBody,
  Flex,
  Heading,
  Select,
  SimpleGrid,
  Text,
} from "@chakra-ui/react";
import { farmsApi, getApiError, weatherApi } from "@/api/client";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { ChartCard } from "@/components/ui/StatCard";
import { ChartFrame } from "@/components/ui/ChartFrame";
import { useTranslation } from "react-i18next";

export default function WeatherPage() {
  const { t } = useTranslation("operate");
  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: () => farmsApi.list() });
  const [farm, setFarm] = useState("");
  const farmId = farm || farmsQ.data?.results[0]?.id;
  const currentQ = useQuery({ queryKey: ["weather-current", farmId], queryFn: () => weatherApi.current(farmId), enabled: !!farmId });
  const forecastQ = useQuery({ queryKey: ["weather-forecast", farmId], queryFn: () => weatherApi.forecast(farmId), enabled: !!farmId });
  const historyQ = useQuery({ queryKey: ["weather-history", farmId], queryFn: () => weatherApi.history({ farm: farmId }), enabled: !!farmId });
  const alertsQ = useQuery({ queryKey: ["weather-alerts", farmId], queryFn: () => weatherApi.alerts(farmId), enabled: !!farmId });
  const recQ = useQuery({ queryKey: ["weather-recs", farmId], queryFn: () => weatherApi.recommendations(farmId), enabled: !!farmId });
  const stationsQ = useQuery({ queryKey: ["weather-stations"], queryFn: () => weatherApi.stations() });

  const frost = (alertsQ.data ?? []).filter((a) => a.alert_type === "frost");
  const heat = (alertsQ.data ?? []).filter((a) => a.alert_type === "heat");
  const current = currentQ.data;
  const forecast = forecastQ.data ?? [];
  const history = historyQ.data ?? [];

  const tempLine = useMemo(
    () => history.map((h) => ({ date: h.date, high: h.temp_high, low: h.temp_low })),
    [history],
  );

  return (
    <Box>
      <PageHeader
        title={t("weather.title")}
        subtitle={t("weather.subtitle")}
        actions={
          <Select aria-label={t("labels.farm", { ns: "common" })} value={farmId ?? ""} onChange={(e) => setFarm(e.target.value)} maxW="xs" bg="bg.surface">
            {(farmsQ.data?.results ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        }
      />
      <ErrorBanner message={currentQ.error ? getApiError(currentQ.error) : null} />
      {frost.map((a) => (
        <Alert key={a.id} status="info" borderRadius="md" mb={2.5}>
          <AlertIcon />
          <Text as="span">
            <Text as="strong">{a.title}</Text> — {a.message}
          </Text>
        </Alert>
      ))}
      {heat.map((a) => (
        <Alert key={a.id} status="warning" borderRadius="md" mb={2.5}>
          <AlertIcon />
          <Text as="span">
            <Text as="strong">{a.title}</Text> — {a.message}
          </Text>
        </Alert>
      ))}
      <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface" mb={4}>
        <CardBody>
          <Flex justify="space-between" align="center" gap={6} wrap="wrap">
            <Box>
              <Text color="fg.muted">Now at {farmsQ.data?.results.find((f) => f.id === farmId)?.name}</Text>
              <Text fontFamily="heading" fontSize="5xl" lineHeight="1.1">
                {current ? `${Math.round(current.temperature_f)}°` : "—"}
              </Text>
              <Text>
                {current?.conditions ?? "No station feed"} · Feels {current?.feels_like ?? "—"}°
              </Text>
            </Box>
            <Box>
              <Text>Humidity {current?.humidity ?? "—"}%</Text>
              <Text>Wind {current?.wind_mph ?? "—"} mph</Text>
              <Text>Rain today {current?.rainfall_in ?? "—"} in</Text>
            </Box>
          </Flex>
        </CardBody>
      </Card>
      <Flex gap={3} overflowX="auto" mb={4}>
        {forecast.map((d) => (
          <Card key={d.date} as="article" variant="outline" borderColor="border.default" bg="bg.surface" minW="140px" flexShrink={0}>
            <CardBody py={3}>
              <Text color="fg.muted">{safeDay(d.date)}</Text>
              <Text as="strong">
                {Math.round(d.high)}° / {Math.round(d.low)}°
              </Text>
              <Text>{d.conditions}</Text>
              <Text color="fg.muted">
                {d.precip_chance}% · {d.rainfall_in} in
              </Text>
            </CardBody>
          </Card>
        ))}
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <ChartCard title={t("weather.rainfallHistory")}>
          <ChartFrame height="220px">
            <BarChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="rainfall_in" fill="#3D7EA6" />
            </BarChart>
            </ChartFrame>
        </ChartCard>
        <ChartCard title={t("weather.temperatureTrend")}>
          <ChartFrame height="220px">
            <LineChart data={tempLine}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Line dataKey="high" stroke="#B54708" dot={false} />
              <Line dataKey="low" stroke="#175CD3" dot={false} />
            </LineChart>
            </ChartFrame>
        </ChartCard>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        {(recQ.data ?? []).map((r) => (
          <Card key={r.id} as="article" variant="outline" borderColor="border.default" bg="bg.surface">
            <CardBody>
              <Badge colorScheme="brand" variant="subtle" mb={2}>
                {r.category}
              </Badge>
              <Heading size="sm" mb={2}>
                {r.title}
              </Heading>
              <Text>{r.body}</Text>
            </CardBody>
          </Card>
        ))}
        {!recQ.data?.length ? (
          <Card as="article" variant="outline" borderColor="border.default" bg="bg.surface">
            <CardBody>
              <Heading size="sm" mb={2}>
                Recommendations
              </Heading>
              <Text color="fg.muted">{t("weather.noRecommendations")}</Text>
            </CardBody>
          </Card>
        ) : null}
      </SimpleGrid>
      <Text color="fg.muted" mt={4}>
        {stationsQ.data?.count ?? 0} weather stations registered.
      </Text>
    </Box>
  );
}

function safeDay(iso: string) {
  try {
    return format(parseISO(iso), "EEE");
  } catch {
    return iso;
  }
}
