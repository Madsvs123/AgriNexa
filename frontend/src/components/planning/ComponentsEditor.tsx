import { Box, Button, Flex, IconButton, Input, Select, Stack, Text } from "@chakra-ui/react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlanningLabels } from "@/lib/usePlanningLabels";
import type { Crop, StrategyComponent, Variety } from "@/types";
import { CropChip } from "./CropChip";

const ROLES = ["intercrop", "relay", "cover"] as const;

/**
 * Editor for the secondary crops in a mixed-cropping plan.
 *
 * Shares are percentages of the field; whatever is not assigned goes to the
 * primary crop, so the running total is shown and capped at 100.
 */
export function ComponentsEditor({
  value,
  onChange,
  crops,
  varieties,
  primaryCropId,
  primaryCropName,
}: {
  value: StrategyComponent[];
  onChange: (next: StrategyComponent[]) => void;
  crops: Crop[];
  varieties: Variety[];
  primaryCropId?: string | null;
  primaryCropName?: string | null;
}) {
  const { t } = useTranslation("grow");
  const labels = usePlanningLabels();
  const total = value.reduce((sum, c) => sum + (Number(c.share_pct) || 0), 0);
  const remainder = Math.max(0, 100 - total);
  const primary = crops.find((c) => c.id === primaryCropId);
  const compatible = new Set(primary?.compatible_intercrops ?? []);
  const options = crops.filter((c) => c.id !== primaryCropId);

  const update = (i: number, patch: Partial<StrategyComponent>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => {
    const first = options.find((c) => compatible.has(c.id)) ?? options[0];
    if (!first) return;
    onChange([...value, { crop: first.id, variety: null, share_pct: Math.min(30, remainder || 30), role: "intercrop" }]);
  };

  return (
    <Stack spacing={3}>
      {primaryCropName ? (
        <Flex align="center" gap={3} p={2.5} bg="bg.subtle" borderRadius="md">
          <CropChip name={primaryCropName} color={primary?.color_hex} detail={labels.componentRole("primary")} />
          <Box flex="1" />
          <Text fontSize="sm" fontWeight="semibold">
            {remainder}%
          </Text>
        </Flex>
      ) : null}

      {value.map((c, i) => {
        const crop = crops.find((x) => x.id === c.crop);
        const cropVarieties = varieties.filter((v) => v.crop === c.crop);
        return (
          <Flex key={i} gap={2} align="flex-end" wrap="wrap">
            <Box flex="2 1 160px">
              <Text fontSize="xs" color="fg.muted" mb={1}>
                {t("labels.crop", { ns: "common" })}
              </Text>
              <Select size="sm" value={c.crop} onChange={(e) => update(i, { crop: e.target.value, variety: null })}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {compatible.has(o.id) ? " ✓" : ""}
                  </option>
                ))}
              </Select>
            </Box>
            <Box flex="2 1 140px">
              <Text fontSize="xs" color="fg.muted" mb={1}>
                {t("labels.variety", { ns: "common" })}
              </Text>
              <Select
                size="sm"
                value={c.variety ?? ""}
                onChange={(e) => update(i, { variety: e.target.value || null })}
                isDisabled={!cropVarieties.length}
              >
                <option value="">{cropVarieties.length ? t("mix.anyVariety") : t("mix.noVarieties")}</option>
                {cropVarieties.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </Box>
            <Box flex="1 1 80px">
              <Text fontSize="xs" color="fg.muted" mb={1}>
                {t("mix.sharePct")}
              </Text>
              <Input
                size="sm"
                type="number"
                min={1}
                max={100}
                value={c.share_pct}
                onChange={(e) => update(i, { share_pct: Number(e.target.value) })}
              />
            </Box>
            <Box flex="1 1 110px">
              <Text fontSize="xs" color="fg.muted" mb={1}>
                {t("mix.role")}
              </Text>
              <Select size="sm" value={c.role ?? "intercrop"} onChange={(e) => update(i, { role: e.target.value })}>
                {ROLES.map((v) => (
                  <option key={v} value={v}>
                    {labels.componentRole(v)}
                  </option>
                ))}
              </Select>
            </Box>
            <IconButton
              aria-label={t("mix.removeComponent", { crop: crop?.name ?? "" })}
              icon={<Trash2 size={14} />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={() => remove(i)}
            />
          </Flex>
        );
      })}

      <Flex align="center" gap={3}>
        <Button size="sm" variant="outline" colorScheme="gray" leftIcon={<Plus size={14} />} onClick={add} isDisabled={!options.length}>
          {t("mix.addCrop")}
        </Button>
        <Text fontSize="sm" color={total > 100 ? "red.500" : "fg.muted"}>
          {t("mix.shareSummary", { total, remainder })}
          {compatible.size ? ` · ${t("mix.compatibleHint")}` : ""}
        </Text>
      </Flex>
    </Stack>
  );
}
