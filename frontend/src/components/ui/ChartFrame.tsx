import type { ReactNode } from "react";
import { Box } from "@chakra-ui/react";
import { ResponsiveContainer } from "recharts";

/**
 * Left-to-right frame for a Recharts figure.
 *
 * Recharts positions axes, legends, and tooltips from physical coordinates and
 * does not mirror. Rendering a chart inside an RTL page puts the Y axis on the
 * wrong side of its own plot area and detaches tooltips from their points, so
 * the figure is an LTR island. Numerals are Western in every language here, so
 * the axis labels read correctly either way; only translated series names and
 * legend text differ, and those lay out fine inside an LTR box.
 */
export function ChartFrame({
  children,
  height = "260px",
}: {
  children: ReactNode;
  height?: string | number;
}) {
  return (
    <Box dir="ltr" h={height} w="100%">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </Box>
  );
}
