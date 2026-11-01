import type { ReactNode } from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { ErrorBanner, SkeletonBlock } from "@/components/ui/FormField";
import { useRegisterPageTitle } from "@/components/layout/PageTitleContext";
import { density } from "@/theme";

/**
 * Canonical layout for index pages.
 *
 * Header, filter bar, and body in one consistent rhythm, so seventeen list
 * pages stop each inventing their own spacing and header markup.
 */
export function ListPage({
  title,
  subtitle,
  actions,
  filters,
  stats,
  error,
  loading,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  stats?: ReactNode;
  error?: string | null;
  loading?: boolean;
  children: ReactNode;
}) {
  useRegisterPageTitle(title);

  return (
    <Box>
      <Flex as="header" align="flex-start" justify="space-between" gap={4} wrap="wrap" mb={density.card}>
        <Box minW={0}>
          <Heading size="lg">{title}</Heading>
          {subtitle ? (
            <Text color="fg.muted" mt={1}>
              {subtitle}
            </Text>
          ) : null}
        </Box>
        {actions ? (
          <Flex gap={2} align="center" flexShrink={0}>
            {actions}
          </Flex>
        ) : null}
      </Flex>

      <ErrorBanner message={error} />

      {stats ? <Box mb={density.card}>{stats}</Box> : null}
      {filters ? <Box mb={density.card}>{filters}</Box> : null}

      {loading ? <SkeletonBlock rows={6} /> : children}
    </Box>
  );
}
