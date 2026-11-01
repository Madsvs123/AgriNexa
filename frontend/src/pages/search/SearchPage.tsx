import { useMemo } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Card, CardBody, Flex, Heading, Input, Text } from "@chakra-ui/react";
import { getApiError, platformApi } from "@/api/client";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { EmptyState } from "@/components/ui/StatCard";
import { useTranslation } from "react-i18next";

export default function SearchPage() {
  const { t } = useTranslation("insights");
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const searchQ = useQuery({
    queryKey: ["search-page", q],
    queryFn: () => platformApi.search(q),
    enabled: q.trim().length > 0,
  });
  const data = searchQ.data;
  const groups = useMemo(
    () => [
      { label: "Farms", items: (data?.farms ?? []).map((x) => ({ id: x.id, name: x.name, to: `/farms/${x.id}`, meta: x.code })) },
      { label: "Fields", items: (data?.fields ?? []).map((x) => ({ id: x.id, name: x.name, to: `/fields/${x.id}`, meta: x.farm_name })) },
      {
        label: "Equipment",
        items: (data?.equipment ?? []).map((x) => ({ id: x.id, name: x.name, to: `/equipment/${x.id}`, meta: `${x.make} ${x.model}` })),
      },
      {
        label: "Inventory",
        items: (data?.inventory ?? []).map((x) => ({ id: x.id, name: x.name, to: `/inventory/${x.id}`, meta: x.sku })),
      },
      { label: "Tasks", items: (data?.tasks ?? []).map((x) => ({ id: x.id, name: x.title, to: "/tasks", meta: x.status })) },
    ],
    [data],
  );
  const any = groups.some((g) => g.items.length);

  return (
    <Box>
      <PageHeader title={t("search.title")} subtitle={t("search.subtitle")} />
      <Flex
        as="form"
        gap={3}
        wrap="wrap"
        mb={4}
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Input
          minW="280px"
          maxW="420px"
          value={q}
          onChange={(e) => setParams({ q: e.target.value })}
          placeholder={t("search.placeholder")}
          aria-label={t("search.title")}
        />
      </Flex>
      <ErrorBanner message={searchQ.error ? getApiError(searchQ.error) : null} />
      {!q ? (
        <Card variant="outline" borderColor="border.default" bg="bg.surface">
          <EmptyState title={t("search.startTyping")} body={t("search.startBody")} />
        </Card>
      ) : !any && searchQ.isFetched ? (
        <Card variant="outline" borderColor="border.default" bg="bg.surface">
          <EmptyState title={`No matches for “${q}”`} body={t("search.noResultsBody")} />
        </Card>
      ) : (
        groups.map((g) =>
          g.items.length ? (
            <Card as="section" key={g.label} variant="outline" borderColor="border.default" bg="bg.surface" mb={3}>
              <CardBody>
                <Heading size="sm">{g.label}</Heading>
                {g.items.map((item) => (
                  <Flex key={item.id} as={RouterLink} to={item.to} align="center" gap={2} py={2}>
                    <Text as="span" fontWeight="semibold">
                      {item.name}
                    </Text>
                    <Text as="span" color="fg.muted">
                      {item.meta}
                    </Text>
                  </Flex>
                ))}
              </CardBody>
            </Card>
          ) : null,
        )
      )}
    </Box>
  );
}
