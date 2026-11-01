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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyticsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { ChartCard } from "@/components/ui/StatCard";

export default function AnalyticsPage() {
  const overviewQ = useQuery({ queryKey: ["analytics-overview"], queryFn: () => analyticsApi.overview() });
  const yieldsQ = useQuery({ queryKey: ["analytics-yields"], queryFn: () => analyticsApi.yields() });
  const waterQ = useQuery({ queryKey: ["analytics-water"], queryFn: () => analyticsApi.water() });
  const costsQ = useQuery({ queryKey: ["analytics-costs"], queryFn: () => analyticsApi.costs() });
  const o = overviewQ.data;

  return (
    <Box>
      <PageHeader title="Analytics" subtitle="Yield, water, cost, and field health trends." />
      <ErrorBanner message={overviewQ.error ? getApiError(overviewQ.error) : null} />
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <ChartCard title="Yield trend">
          <Box h="220px">
            <ResponsiveContainer>
              <AreaChart data={o?.water_trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Area dataKey="value" stroke="#2F6F4E" fill="#7CB51833" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
        <ChartCard title="Water trend">
          <Box h="220px">
            <ResponsiveContainer>
              <LineChart data={o?.yield_trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d7" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Line dataKey="value" stroke="#3D7EA6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <ChartCard title="Cost trend">
          <Box h="220px">
            <ResponsiveContainer>
              <BarChart data={o?.cost_trend ?? []}>
                <XAxis dataKey="date" hide />
                <Tooltip />
                <Bar dataKey="value" fill="#8C5A3C" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
        <ChartCard title="Field health mix">
          <Box h="220px">
            <ResponsiveContainer>
              <AreaChart data={o?.health_trend ?? []}>
                <XAxis dataKey="date" hide />
                <Tooltip />
                <Area dataKey="healthy" stackId="1" fill="#7CB518" />
                <Area dataKey="warning" stackId="1" fill="#D4A017" />
                <Area dataKey="critical" stackId="1" fill="#B42318" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <ChartCard title="Yield by crop">
          <Box h="200px">
            <ResponsiveContainer>
              <BarChart data={yieldsQ.data?.by_crop ?? []}>
                <XAxis dataKey="crop_name" />
                <Tooltip />
                <Bar dataKey="actual" fill="#2F6F4E" />
                <Bar dataKey="target" fill="#D4A017" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
        <ChartCard title="Water by farm">
          <Box h="200px">
            <ResponsiveContainer>
              <BarChart data={waterQ.data?.by_farm ?? []}>
                <XAxis dataKey="farm_name" hide />
                <Tooltip />
                <Bar dataKey="gallons" fill="#3D7EA6" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
        <ChartCard title="Costs by category">
          <Box h="200px">
            <ResponsiveContainer>
              <BarChart data={costsQ.data?.by_category ?? []}>
                <XAxis dataKey="category" hide />
                <Tooltip />
                <Bar dataKey="amount" fill="#8C5A3C" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
      </SimpleGrid>
    </Box>
  );
}
