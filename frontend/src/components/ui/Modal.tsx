import type { ReactNode } from "react";
import {
  Button,
  Drawer as ChakraDrawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Modal as ChakraModal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from "@chakra-ui/react";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <ChakraModal isOpen={open} onClose={onClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent bg="bg.surface">
        <ModalHeader fontFamily="heading">{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={footer ? 0 : 6}>{children}</ModalBody>
        {footer ? <ModalFooter gap={2}>{footer}</ModalFooter> : null}
      </ModalContent>
    </ChakraModal>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <ChakraDrawer isOpen={open} onClose={onClose} placement="end" size={wide ? "lg" : "md"}>
      <DrawerOverlay />
      <DrawerContent bg="bg.surface">
        <DrawerCloseButton />
        <DrawerHeader fontFamily="heading">{title}</DrawerHeader>
        <DrawerBody pb={6}>{children}</DrawerBody>
      </DrawerContent>
    </ChakraDrawer>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" colorScheme="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme={danger ? "red" : "brand"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Text color="fg.muted">{body}</Text>
    </Modal>
  );
}
