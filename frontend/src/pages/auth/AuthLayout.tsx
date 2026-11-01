import { Link as RouterLink } from "react-router-dom";
import { Leaf } from "lucide-react";
import type { ReactNode } from "react";
import { Box, Flex, Heading, Link, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

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
  const { t } = useTranslation("auth");

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
            {t("brand.headline")}
          </Heading>
          <Text mt={4} maxW="md" color="whiteAlpha.800">
            {t("brand.blurb")}
          </Text>
        </Box>
        <Text color="whiteAlpha.600">{t("brand.footer")}</Text>
      </Flex>
      <Flex flex="1" align="center" justify="center" p={{ base: 6, md: 10 }} bg="bg.canvas">
        <Box w="100%" maxW="420px">
          <Flex justify="flex-end" mb={2}>
            <LanguageSwitcher />
          </Flex>
          <Heading size="lg">{title}</Heading>
          <Text color="fg.muted" mt={1} mb={6}>
            {subtitle}
          </Text>
          {children}
          {footer ? <Box mt={5}>{footer}</Box> : null}
          <Text fontSize="sm" color="fg.muted" mt={6}>
            <Link as={RouterLink} to="/signin" color="brand.500">
              {t("signIn")}
            </Link>{" "}
            ·{" "}
            <Link as={RouterLink} to="/register" color="brand.500">
              {t("createOrganization")}
            </Link>
          </Text>
        </Box>
      </Flex>
    </Flex>
  );
}
