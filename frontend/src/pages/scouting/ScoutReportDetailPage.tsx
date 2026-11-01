import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Heading,
  Image,
  Link,
  SimpleGrid,
  Text,
} from "@chakra-ui/react";
import { getApiError, scoutingApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatCard";
import { SeverityMeter } from "@/components/ui/SensorSparkline";
import { useTranslation } from "react-i18next";

export default function ScoutReportDetailPage() {
  const { t } = useTranslation("operate");
  const { id = "" } = useParams();
  const reportQ = useQuery({ queryKey: ["scout-report", id], queryFn: () => scoutingApi.getReport(id), enabled: !!id });
  const r = reportQ.data;
  if (reportQ.isLoading) {
    return (
      <Box>
        <SkeletonBlock />
      </Box>
    );
  }
  if (!r) {
    return (
      <Box>
        <ErrorBanner message={reportQ.error ? getApiError(reportQ.error) : "Report not found."} />
      </Box>
    );
  }
  return (
    <Box>
      <PageHeader
        title={r.field_name ?? "Scout report"}
        subtitle={`${r.farm_name ?? ""} · ${formatDateTime(r.observed_at)}`}
        crumbs={
          <>
            <Link as={RouterLink} to="/scouting/treatments">
              Scouting
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">Report</Text>
          </>
        }
      />
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Flex align="center" gap={2} justify="space-between">
              <Text as="span">Health {r.health_score}</Text>
              <Box w="100px">
                <SeverityMeter value={r.severity} />
              </Box>
            </Flex>
            <Text>{r.notes}</Text>
            <Heading size="sm" mt={4} mb={2}>
              Diseases
            </Heading>
            {(r.diseases ?? []).map((d, i) => (
              <Flex key={i} align="center" gap={2}>
                <StatusBadge status={d.severity} /> {d.name}
              </Flex>
            ))}
            <Heading size="sm" mt={4} mb={2}>
              Pests
            </Heading>
            {(r.pests ?? []).map((d, i) => (
              <Flex key={i} align="center" gap={2}>
                <StatusBadge status={d.severity} /> {d.name}
              </Flex>
            ))}
            <Heading size="sm" mt={4} mb={2}>
              Weeds
            </Heading>
            {(r.weeds ?? []).map((d, i) => (
              <Flex key={i} align="center" gap={2}>
                <StatusBadge status={d.severity} /> {d.name}
              </Flex>
            ))}
          </CardBody>
        </Card>
        <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
          <CardBody>
            <Heading size="sm" mb={3}>
              Photos
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {(r.photos ?? []).map((p, i) => (
                <Box as="figure" key={p.id ?? i}>
                  <Image src={p.image} alt={p.caption || "Scout photo"} borderRadius="lg" />
                  <Text as="figcaption" color="fg.muted">
                    {p.caption}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
            {!r.photos?.length ? <Text color="fg.muted">{t("scouting.noPhotos")}</Text> : null}
            <Button as={RouterLink} to="/scouting/treatments" colorScheme="brand" mt={3}>
              Plan treatment
            </Button>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  );
}
