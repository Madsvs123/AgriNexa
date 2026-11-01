import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardBody, Flex, Spacer, Stack, Tag, Text } from "@chakra-ui/react";
import { getApiError, platformApi } from "@/api/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, ErrorBanner } from "@/components/ui/FormField";
import { EmptyState } from "@/components/ui/StatCard";
import { useTranslation } from "react-i18next";

export default function NotificationsPage() {
  const { t } = useTranslation("insights");
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ["notifications"], queryFn: () => platformApi.notifications() });
  const read = useMutation({
    mutationFn: (id: string) => platformApi.readNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => platformApi.readAllNotifications(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Box>
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        actions={
          <Button variant="ghost" colorScheme="gray" onClick={() => readAll.mutate()}>
            Mark all read
          </Button>
        }
      />
      <ErrorBanner message={listQ.error ? getApiError(listQ.error) : null} />
      {(listQ.data?.results ?? []).length === 0 ? (
        <Box bg="bg.surface" borderWidth="1px" borderColor="border.default" borderRadius="xl">
          <EmptyState title={t("notifications.quietTitle")} body={t("notifications.quietBody")} />
        </Box>
      ) : (
        <Stack spacing={4}>
          {(listQ.data?.results ?? []).map((n) => (
            <Card
              key={n.id}
              as="article"
              variant="outline"
              borderColor="border.default"
              bg="bg.surface"
              opacity={n.is_read ? 0.7 : 1}
            >
              <CardBody>
                <Flex align="center" gap={2}>
                  <Text fontWeight="semibold">{n.title}</Text>
                  <Spacer />
                  <Tag size="sm" colorScheme="gray" variant="subtle">
                    {n.category}
                  </Tag>
                </Flex>
                <Text mt={1}>{n.body}</Text>
                <Text fontSize="sm" color="fg.muted" mt={1}>
                  {formatDateTime(n.created_at)}
                </Text>
                {!n.is_read ? (
                  <Button variant="ghost" colorScheme="gray" size="sm" mt={2} onClick={() => read.mutate(n.id)}>
                    Mark read
                  </Button>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
