import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Card, CardBody, Flex, Heading, Link, Stack, Tag, Text } from "@chakra-ui/react";
import { cropsApi, getApiError } from "@/api/client";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { EmptyState } from "@/components/ui/StatCard";

export default function RotationsPage() {
  const rotQ = useQuery({ queryKey: ["rotations"], queryFn: () => cropsApi.rotations() });
  return (
    <Box>
      <PageHeader
        title="Rotations"
        subtitle="Sequence chips for each field’s crop history going forward."
        crumbs={
          <>
            <Link as={RouterLink} to="/crops">
              Crops
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">Rotations</Text>
          </>
        }
      />
      <ErrorBanner message={rotQ.error ? getApiError(rotQ.error) : null} />
      {!(rotQ.data?.results ?? []).length ? (
        <Box bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl">
          <EmptyState title="No rotations defined" body="A corn–soy–wheat sequence on South Bottom will show as chips here." />
        </Box>
      ) : (
        <Stack spacing={4}>
          {(rotQ.data?.results ?? []).map((r) => (
            <Card as="section" key={r.id} variant="outline" borderColor="border.default" bg="bg.surface">
              <CardBody>
                <Heading size="sm">
                  {r.name}{" "}
                  <Text as="span" color="fg.muted" fontWeight="normal">
                    · {r.field_name}
                  </Text>
                </Heading>
                <Flex align="center" gap={2} wrap="wrap" mt={2.5}>
                  {(r.sequence ?? []).map((step, i) => (
                    <Tag key={`${step.year}-${step.crop_name}-${i}`} colorScheme={i % 2 ? "wheat" : "brand"} borderRadius="full">
                      {step.year} {step.season} · {step.crop_name}
                    </Tag>
                  ))}
                </Flex>
                {r.notes ? (
                  <Text color="fg.muted" mt={2}>
                    {r.notes}
                  </Text>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
