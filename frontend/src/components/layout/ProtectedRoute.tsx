import { Navigate, Outlet } from "react-router-dom";
import { Center, Spinner, Text, VStack } from "@chakra-ui/react";
import { useAuthStore } from "@/stores/authStore";

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.accessToken);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  if (!bootstrapped) {
    return (
      <Center minH="100vh">
        <VStack spacing={3}>
          <Spinner color="brand.500" />
          <Text color="fg.muted">Loading operations center…</Text>
        </VStack>
      </Center>
    );
  }
  if (!token) return <Navigate to="/signin" replace />;
  return <Outlet />;
}
