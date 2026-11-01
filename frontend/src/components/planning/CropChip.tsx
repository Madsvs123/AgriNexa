import { Box, Flex, Text } from "@chakra-ui/react";
import { fallbackColor } from "@/lib/planning";

export function CropChip({
  name,
  color,
  detail,
  size = "sm",
}: {
  name: string;
  color?: string | null;
  detail?: string | null;
  size?: "xs" | "sm" | "md";
}) {
  const dot = size === "xs" ? 2 : size === "md" ? 3.5 : 3;
  return (
    <Flex align="center" gap={2} minW={0}>
      <Box boxSize={dot} borderRadius="sm" flexShrink={0} bg={color || fallbackColor(name)} />
      <Text as="span" fontSize={size === "xs" ? "xs" : size === "md" ? "md" : "sm"} fontWeight="semibold" noOfLines={1}>
        {name}
      </Text>
      {detail ? (
        <Text as="span" fontSize={size === "xs" ? "xs" : "sm"} color="fg.muted" noOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </Flex>
  );
}
