import { Link as RouterLink } from "react-router-dom";
import { Leaf } from "lucide-react";
import type { ReactNode } from "react";
import { Box, Flex, Heading, Link, Text } from "@chakra-ui/react";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Flex minH="100vh" direction={{ base: "column", lg: "row" }}>
      <Flex
        direction="column"
        justify="space-between"
        flex="1"
        bg="brand.800"
        color="whiteAlpha.900"
        p={{ base: 8, lg: 14 }}
        display={{ base: "none", lg: "flex" }}
      >
        <Box>
          <Flex align="center" gap={3}>
            <Flex boxSize={9} align="center" justify="center" borderRadius="lg" bg="brand.500">
              <Leaf size={18} />
            </Flex>
            <Text fontFamily="heading" fontSize="2xl" fontWeight="semibold">
              AgriNexa
            </Text>
          </Flex>
          <Heading size="xl" mt={10} maxW="md" fontWeight="semibold">
            Precision farming, unified.
          </Heading>
          <Text mt={4} maxW="md" color="whiteAlpha.800">
            Fields, moisture, irrigation, and yield in one operations center — built for growers who run North Ridge
            and Willow Creek like a fleet.
          </Text>
        </Box>
        <Text color="whiteAlpha.600">Satellite layers · live sensors · seasonal plans</Text>
      </Flex>
      <Flex flex="1" align="center" justify="center" p={{ base: 6, md: 10 }} bg="bg.canvas">
        <Box w="100%" maxW="420px">
          <Heading size="lg">{title}</Heading>
          <Text color="fg.muted" mt={1} mb={6}>
            {subtitle}
          </Text>
          {children}
          {footer ? <Box mt={5}>{footer}</Box> : null}
          <Text fontSize="sm" color="fg.muted" mt={6}>
            <Link as={RouterLink} to="/signin" color="brand.500">
              Sign in
            </Link>{" "}
            ·{" "}
            <Link as={RouterLink} to="/register" color="brand.500">
              Create organization
            </Link>
          </Text>
        </Box>
      </Flex>
    </Flex>
  );
}
