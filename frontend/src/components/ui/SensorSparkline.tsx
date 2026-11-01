import { Box, Checkbox, Flex, Stack, Text } from "@chakra-ui/react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export function SensorSparkline({ values, color = "#2F6F4E" }: { values: number[]; color?: string }) {
  const data = values.map((v, i) => ({ i, v }));
  if (!data.length) {
    return (
      <Text as="span" fontSize="sm" color="fg.muted">
        No series
      </Text>
    );
  }
  return (
    <Box w="100%" dir="ltr" h="42px">
      {/* Time runs left-to-right in every locale. */}
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            formatter={(value) => [value ?? "—", "Reading"]}
            labelFormatter={() => ""}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  low: "green.400",
  medium: "yellow.400",
  high: "orange.400",
  critical: "red.500",
};

export function SeverityMeter({
  value,
}: {
  value: "low" | "medium" | "high" | "critical" | number;
}) {
  const level =
    typeof value === "number" ? (value <= 2 ? "low" : value <= 3 ? "medium" : value <= 4 ? "high" : "critical") : value;
  const filled = level === "low" ? 1 : level === "medium" ? 2 : level === "high" ? 3 : 4;
  return (
    <Flex gap={1} aria-label={`Severity ${level}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Box
          key={i}
          w="14px"
          h="6px"
          borderRadius="full"
          bg={i < filled ? SEVERITY_COLOR[level] : "border.default"}
        />
      ))}
    </Flex>
  );
}

export function LayerToggle({
  layers,
  onChange,
}: {
  layers: { key: string; label: string; on: boolean }[];
  onChange: (key: string, on: boolean) => void;
}) {
  return (
    <Stack
      spacing={2}
      p={3}
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="lg"
      boxShadow="md"
    >
      <Text fontWeight="semibold" fontSize="sm">
        Layers
      </Text>
      {layers.map((l) => (
        <Checkbox key={l.key} isChecked={l.on} onChange={(e) => onChange(l.key, e.target.checked)} colorScheme="brand">
          {l.label}
        </Checkbox>
      ))}
    </Stack>
  );
}
