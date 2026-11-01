import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Card, CardBody, Text } from "@chakra-ui/react";
import { PageHeader } from "@/components/ui/FormField";

export default function NotFoundPage() {
  return (
    <Box>
      <PageHeader title="Field not on the map" subtitle="That route is fallow — nothing is planted here." />
      <Card variant="outline" borderColor="border.default" bg="bg.surface" maxW="480px">
        <CardBody>
          <Box boxSize={12} borderRadius="full" bg="brand.50" _dark={{ bg: "whiteAlpha.200" }} mb={3} />
          <Text mb={4}>The page you requested is not part of AgriNexa operations.</Text>
          <Button as={RouterLink} to="/home" colorScheme="brand">
            Back to dashboard
          </Button>
        </CardBody>
      </Card>
    </Box>
  );
}
