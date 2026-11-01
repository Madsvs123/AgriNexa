import { useTranslation } from "react-i18next";
import { Text } from "@chakra-ui/react";
import { formatMonthDay } from "@/i18n/format";
import type { PlanningMessage as PlanningMessageData } from "@/types";

/** Params the API sends as ISO dates, rendered in the active locale. */
const DATE_PARAMS = new Set([
  "window_start",
  "window_end",
  "closes",
  "harvest",
  "harvest_by",
  "harvest_date",
  "season_end",
]);

/**
 * Render a planning warning from its code.
 *
 * The API sends `{ code, params, message }`. Translating from the code rather
 * than the English `message` lets each language choose its own word order,
 * plural category, and date format — Arabic needs six plural forms where
 * English has two, and none of that survives an interpolated English sentence.
 * If a code has no translation yet, the English `message` is shown rather than
 * a raw key.
 */
export function usePlanningMessage() {
  const { t, i18n } = useTranslation("grow");

  return (entry: PlanningMessageData): string => {
    const key = `warnings.${entry.code}`;
    const params: Record<string, unknown> = { ...entry.params };
    for (const [k, v] of Object.entries(params)) {
      if (DATE_PARAMS.has(k) && typeof v === "string") params[k] = formatMonthDay(v);
    }
    // `count` drives plural selection; it must stay a number.
    if (params.count !== undefined) params.count = Number(params.count);

    if (!i18n.exists(key, { ns: "grow" })) return entry.message;
    const text = String(t(key, params as never));

    return entry.field
      ? String(t("warnings.withField", { field: entry.field, message: text }))
      : text;
  };
}

export function PlanningMessageText({
  entry,
  ...rest
}: { entry: PlanningMessageData } & React.ComponentProps<typeof Text>) {
  const render = usePlanningMessage();
  return <Text {...rest}>{render(entry)}</Text>;
}
