import { useNavigate, useLocation } from "react-router-dom";
import { Box, Flex, Text, Tooltip, VisuallyHidden } from "@chakra-ui/react";
import { Leaf } from "lucide-react";
import { SECTIONS, sectionForPath, type NavSection } from "@/navigation/manifest";
import { layout } from "@/theme";

function RailButton({
  section,
  active,
  onSelect,
}: {
  section: NavSection;
  active: boolean;
  onSelect: (s: NavSection) => void;
}) {
  const Icon = section.icon;
  return (
    <Tooltip label={section.label} placement="right" openDelay={400}>
      <Box
        as="button"
        type="button"
        onClick={() => onSelect(section)}
        aria-current={active ? "page" : undefined}
        w="100%"
        py={2.5}
        position="relative"
        color={active ? "white" : "whiteAlpha.700"}
        bg={active ? "whiteAlpha.200" : "transparent"}
        _hover={{ bg: "whiteAlpha.300", color: "white" }}
        _focusVisible={{ outline: "2px solid", outlineColor: "wheat.300", outlineOffset: "-2px" }}
        transition="background 0.15s, color 0.15s"
      >
        {active ? (
          <Box
            position="absolute"
            left={0}
            top={1.5}
            bottom={1.5}
            w="3px"
            borderRightRadius="full"
            bg="wheat.400"
          />
        ) : null}
        <Flex direction="column" align="center" gap={1}>
          <Icon size={20} aria-hidden />
          <Text fontSize="10px" lineHeight="1" fontWeight={active ? "semibold" : "normal"}>
            {section.label}
          </Text>
        </Flex>
      </Box>
    </Tooltip>
  );
}

/**
 * Primary navigation: six sections replacing a flat list of 27 destinations.
 *
 * The rail only picks a *section*; the section panel next to it lists that
 * section's pages. Clicking a section navigates to its home route.
 */
export function NavRail({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeSection = sectionForPath(pathname);

  const primary = SECTIONS.filter((s) => !s.footer);
  const footer = SECTIONS.filter((s) => s.footer);

  const select = (section: NavSection) => {
    navigate(section.home);
    onNavigate?.();
  };

  return (
    <Flex
      as="nav"
      aria-label="Sections"
      direction="column"
      w={layout.railWidth}
      flexShrink={0}
      bg="brand.800"
      color="white"
      h="100%"
    >
      <Flex direction="column" align="center" gap={0.5} py={3} px={2}>
        <Flex boxSize={9} align="center" justify="center" borderRadius="lg" bg="brand.500">
          <Leaf size={18} aria-hidden />
        </Flex>
        <VisuallyHidden>AgriNexa</VisuallyHidden>
      </Flex>

      <Flex direction="column" flex="1" overflowY="auto">
        {primary.map((s) => (
          <RailButton key={s.id} section={s} active={activeSection === s.id} onSelect={select} />
        ))}
      </Flex>

      <Box borderTopWidth="1px" borderColor="whiteAlpha.300">
        {footer.map((s) => (
          <RailButton key={s.id} section={s} active={activeSection === s.id} onSelect={select} />
        ))}
      </Box>
    </Flex>
  );
}
