import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Card, CardBody, Text } from "@chakra-ui/react";
import { PageHeader } from "@/components/ui/FormField";
import { useTranslation } from "react-i18next";

export default function NotFoundPage() {
  const { t } = useTranslation("insights");
  return (
    <Box>
      <PageHeader title={t("notFound.title")} subtitle={t("notFound.subtitle")} />
      <Card variant="outline" borderColor="border.default" bg="bg.surface" maxW="480px">
        <CardBody>
          <Box boxSize={12} borderRadius="full" bg="brand.50" _dark={{ bg: "whiteAlpha.200" }} mb={3} />
          <Text mb={4}>{t("notFound.body")}</Text>
          <Button as={RouterLink} to="/home" colorScheme="brand">
            Back to dashboard
          </Button>
        </CardBody>
      </Card>
    </Box>
  );
}
