import type { ReactNode } from "react";
import {
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Heading,
  IconButton,
  useBreakpointValue,
} from "@chakra-ui/react";
import { X } from "lucide-react";
import { layout } from "@/theme";

/**
 * Right-hand inspector panel.
 *
 * Docked (non-modal) at `xl` and above, a modal drawer below that. Inspect
 * flows used to be modal drawers everywhere — on the map that meant the field
 * details covered the map you were reading them against.
 */
export function ContextPanel({
  open,
  title,
  onClose,
  children,
  footer,
  width = layout.contextPanelWidth,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const docked = useBreakpointValue({ base: false, xl: true }, { fallback: "base" });

  if (!docked) {
    return (
      <Drawer isOpen={open} onClose={onClose} placement="right" size="md">
        <DrawerOverlay />
        <DrawerContent bg="bg.surface">
          <DrawerCloseButton />
          <DrawerHeader fontFamily="heading">{title}</DrawerHeader>
          <DrawerBody pb={6}>{children}</DrawerBody>
          {footer ? (
            <Box px={6} py={4} borderTopWidth="1px" borderColor="border.default">
              {footer}
            </Box>
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  if (!open) return null;

  return (
    <Flex
      as="aside"
      aria-label={title}
      direction="column"
      w={width}
      flexShrink={0}
      bg="bg.surface"
      borderLeftWidth="1px"
      borderColor="border.default"
      h="100%"
      overflow="hidden"
      zIndex="contextPanel"
    >
      <Flex
        align="center"
        gap={2}
        px={4}
        py={3}
        borderBottomWidth="1px"
        borderColor="border.default"
        flexShrink={0}
      >
        <Heading size="sm" fontFamily="heading" noOfLines={1}>
          {title}
        </Heading>
        <Box flex="1" />
        <IconButton
          aria-label="Close panel"
          icon={<X size={16} />}
          size="xs"
          variant="ghost"
          colorScheme="gray"
          onClick={onClose}
        />
      </Flex>
      <Box flex="1" overflowY="auto" px={4} py={4}>
        {children}
      </Box>
      {footer ? (
        <Box px={4} py={3} borderTopWidth="1px" borderColor="border.default" flexShrink={0}>
          {footer}
        </Box>
      ) : null}
    </Flex>
  );
}
