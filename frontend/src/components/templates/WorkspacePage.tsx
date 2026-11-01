import type { ReactNode } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { useRegisterPageTitle } from "@/components/layout/PageTitleContext";

/**
 * Full-viewport canvas layout with collapsible side panels.
 *
 * Used for the map, where tools belong in a docked panel rather than stacked as
 * floating cards over the canvas you are trying to read.
 */
export function WorkspacePage({
  title,
  tools,
  inspector,
  children,
  toolsWidth = "268px",
}: {
  title: string;
  tools?: ReactNode;
  inspector?: ReactNode;
  children: ReactNode;
  toolsWidth?: string;
}) {
  useRegisterPageTitle(title);

  return (
    <Flex h="100%" minH={0} overflow="hidden">
      {tools ? (
        <Box
          as="aside"
          aria-label={`${title} tools`}
          w={toolsWidth}
          flexShrink={0}
          h="100%"
          overflowY="auto"
          bg="bg.surface"
          borderRightWidth="1px"
          borderColor="border.default"
          display={{ base: "none", md: "block" }}
        >
          {tools}
        </Box>
      ) : null}

      <Box flex="1" minW={0} h="100%" position="relative">
        {children}
      </Box>

      {inspector}
    </Flex>
  );
}
