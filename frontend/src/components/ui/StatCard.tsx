import type { ReactNode } from "react";
import { Badge, Box, Card, CardBody, CardHeader, Flex, Heading, Text } from "@chakra-ui/react";
import { statusTone } from "@/lib/utils";

const TONE_SCHEME: Record<string, string> = {
  healthy: "green",
  warning: "yellow",
  critical: "red",
  idle: "gray",
};

export function StatusBadge({ status, label }: { status?: string | null; label?: string }) {
  const tone = statusTone(status);
  const text = label ?? (status ? status.replace(/_/g, " ") : "idle");
  return (
    <Badge colorScheme={TONE_SCHEME[tone] ?? "gray"} variant="subtle" textTransform="capitalize">
      {text}
    </Badge>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Card variant="outline" borderColor="border.default" bg="bg.surface">
      <CardBody py={4}>
        <Flex align="center" gap={1.5} color="fg.muted" fontSize="sm">
          {icon}
          <Text as="span">{label}</Text>
        </Flex>
        <Text fontSize="2xl" fontFamily="heading" fontWeight="semibold" mt={1}>
          {value}
        </Text>
        {hint ? (
          <Text fontSize="xs" color="fg.muted" mt={1}>
            {hint}
          </Text>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Flex direction="column" align="center" textAlign="center" py={10} px={6} gap={2}>
      <Box boxSize={12} borderRadius="full" bg="brand.50" _dark={{ bg: "whiteAlpha.200" }} />
      <Heading size="sm">{title}</Heading>
      <Text color="fg.muted" maxW="md">
        {body}
      </Text>
      {action ? <Box mt={3}>{action}</Box> : null}
    </Flex>
  );
}

export function ChartCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="outline" borderColor="border.default" bg="bg.surface">
      <CardHeader pb={0} display="flex" alignItems="center" justifyContent="space-between">
        <Heading size="sm">{title}</Heading>
        {action}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
