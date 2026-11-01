import { useEffect, type ReactNode } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <FormControl isInvalid={Boolean(error)} mb={4}>
      <FormLabel htmlFor={htmlFor}>{label}</FormLabel>
      {children}
      {hint && !error ? <FormHelperText>{hint}</FormHelperText> : null}
      {error ? <FormErrorMessage>{error}</FormErrorMessage> : null}
    </FormControl>
  );
}

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: string;
  subtitle?: string;
  crumbs?: ReactNode;
  actions?: ReactNode;
}) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <Flex as="header" align="flex-start" justify="space-between" gap={4} wrap="wrap" mb={6}>
      <Box>
        {crumbs ? (
          <Text fontSize="sm" color="fg.muted" mb={1}>
            {crumbs}
          </Text>
        ) : null}
        <Heading size="lg">{title}</Heading>
        {subtitle ? (
          <Text color="fg.muted" mt={1}>
            {subtitle}
          </Text>
        ) : null}
      </Box>
      {actions ? <Flex gap={2} align="center">{actions}</Flex> : null}
    </Flex>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Alert status="error" borderRadius="md" mb={4}>
      <AlertIcon />
      {message}
    </Alert>
  );
}

export function SkeletonBlock({ rows = 4 }: { rows?: number }) {
  return (
    <Stack
      spacing={3}
      p={5}
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="xl"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height="14px" width={`${88 - i * 8}%`} borderRadius="md" />
      ))}
    </Stack>
  );
}

export function SkeletonKpis({ count = 6 }: { count?: number }) {
  return (
    <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={4} mb={6}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height="92px" borderRadius="xl" />
      ))}
    </SimpleGrid>
  );
}
