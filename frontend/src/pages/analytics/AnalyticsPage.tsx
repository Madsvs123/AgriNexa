import { useQuery } from "@tanstack/react-query";
import { Box, SimpleGrid } from "@chakra-ui/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyticsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { ChartCard } from "@/components/ui/StatCard";
import { ChartFrame } from "@/components/ui/ChartFrame";
import { useTranslation } from "react-i18next";

export default function AnalyticsPage() {
  const { t } = useTranslation("insights");
  const overviewQ = useQuery({ queryKey: ["analytics-overview"], queryFn: () => analyticsApi.overview() });
  const yieldsQ = useQuery({ queryKey: ["analytics-yields"], queryFn: () => analyticsApi.yields() });
  const waterQ = useQuery({ queryKey: ["analytics-water"], queryFn: () => analyticsApi.water() });
  const costsQ = useQuery({ queryKey: ["analytics-costs"], queryFn: () => analyticsApi.costs() });
  const o = overviewQ.data;

  return (
    <Box>
      <PageHeader title={t("analytics.title")} subtitle={t("analytics.subtitle")} />
      <ErrorBanner message={overviewQ.error ? getApiError(overviewQ.error) : null} />
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <ChartCard title={t("analytics.yieldTrend")}>
          <ChartFrame height="220px">
            <AreaChart data={o?.water_trend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Area dataKey="value" stroke="#2F6F4E" fill="#7CB51833" />
            </AreaChart>
            </ChartFrame>
        </ChartCard>
        <ChartCard title={t("analytics.waterTrend")}>
          <ChartFrame height="220px">
            <LineChart data={o?.yield_trend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Line dataKey="value" stroke="#3D7EA6" dot={false} />
            </LineChart>
            </ChartFrame>
        </ChartCard>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <ChartCard title={t("analytics.costTrend")}>
          <ChartFrame height="220px">
            <BarChart data={o?.cost_trend ?? []}>
              <XAxis dataKey="date" hide />
              <Tooltip />
              <Bar dataKey="value" fill="#8C5A3C" />
            </BarChart>
            </ChartFrame>
        </ChartCard>
        <ChartCard title={t("analytics.fieldHealthMix")}>
          <ChartFrame height="220px">
            <AreaChart data={o?.health_trend ?? []}>
              <XAxis dataKey="date" hide />
              <Tooltip />
              <Area dataKey="healthy" stackId="1" fill="#7CB518" />
              <Area dataKey="warning" stackId="1" fill="#D4A017" />
              <Area dataKey="critical" stackId="1" fill="#B42318" />
            </AreaChart>
            </ChartFrame>
        </ChartCard>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <ChartCard title={t("analytics.yieldByCrop")}>
          <ChartFrame height="200px">
            <BarChart data={yieldsQ.data?.by_crop ?? []}>
              <XAxis dataKey="crop_name" />
              <Tooltip />
              <Bar dataKey="actual" fill="#2F6F4E" />
              <Bar dataKey="target" fill="#D4A017" />
            </BarChart>
            </ChartFrame>
        </ChartCard>
        <ChartCard title={t("analytics.waterByFarm")}>
          <ChartFrame height="200px">
            <BarChart data={waterQ.data?.by_farm ?? []}>
              <XAxis dataKey="farm_name" hide />
              <Tooltip />
              <Bar dataKey="gallons" fill="#3D7EA6" />
            </BarChart>
            </ChartFrame>
        </ChartCard>
        <ChartCard title={t("analytics.costsByCategory")}>
          <ChartFrame height="200px">
            <BarChart data={costsQ.data?.by_category ?? []}>
              <XAxis dataKey="category" hide />
              <Tooltip />
              <Bar dataKey="amount" fill="#8C5A3C" />
            </BarChart>
            </ChartFrame>
        </ChartCard>
      </SimpleGrid>
    </Box>
  );
}
