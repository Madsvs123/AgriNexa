import { Link as RouterLink } from "react-router-dom";
import { Box, Card, CardBody, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { PageHeader } from "@/components/ui/FormField";

const LINKS = [
  { to: "/settings/organization", title: "Organization", body: "Name, units, currency, and map defaults." },
  { to: "/settings/team", title: "Team", body: "Members, teams, and role assignments." },
  { to: "/settings/roles", title: "Roles", body: "Permission checkboxes for operations." },
  { to: "/settings/invitations", title: "Invitations", body: "Invite agronomists and operators by email." },
  { to: "/settings/access", title: "Farm access", body: "Who can view, edit, or manage each farm." },
  { to: "/settings/profile", title: "Farmer profile", body: "Certifications, specialties, and experience." },
];

export default function SettingsPage() {
  return (
    <Box>
      <PageHeader title="Settings" subtitle="Organization, people, and access." />
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        {LINKS.map((l) => (
          <Card
            key={l.to}
            as={RouterLink}
            to={l.to}
            variant="outline"
            borderColor="border.default"
            bg="bg.surface"
            _hover={{ borderColor: "brand.400", textDecoration: "none" }}
          >
            <CardBody>
              <Heading size="sm">{l.title}</Heading>
              <Text color="fg.muted" mt={1}>
                {l.body}
              </Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
    </Box>
  )
}
