import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { platformApi } from "@/api/client";
import type { NotificationItem } from "@/types";
import { fromNow } from "@/lib/utils";

export function NotificationPanel({
  items,
  onSeeAll,
}: {
  items: NotificationItem[];
  onSeeAll: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
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
      <Flex align="center" px={4} py={3} borderBottomWidth="1px" borderColor="border.default">
        <Text fontWeight="semibold">Notifications</Text>
        <Box flex="1" />
        <Button size="xs" variant="ghost" colorScheme="gray" onClick={() => readAll.mutate()}>
          Mark all read
        </Button>
      </Flex>
      {items.length === 0 ? (
        <Text color="fg.muted" p={4} fontSize="sm">
          Quiet in the yard. Frost, sensor, and inventory alerts will land here.
        </Text>
      ) : (
        items.map((n) => (
          <Box
            key={n.id}
            as="button"
            w="100%"
            textAlign="left"
            px={4}
            py={2.5}
            opacity={n.is_read ? 0.65 : 1}
            _hover={{ bg: "bg.subtle" }}
            onClick={() => {
              if (!n.is_read) read.mutate(n.id);
              navigate(n.link || "/notifications");
            }}
          >
            <Text fontSize="sm">{n.title}</Text>
            <Text fontSize="xs" color="fg.muted">
              {n.body} · {fromNow(n.created_at)}
            </Text>
          </Box>
        ))
      )}
      <Box p={2.5}>
        <Button w="100%" variant="ghost" colorScheme="gray" size="sm" onClick={onSeeAll}>
          Open notification center
        </Button>
      </Box>
    </Box>
  );
}
