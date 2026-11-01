import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardBody, Input, Link, Select, SimpleGrid, Text } from "@chakra-ui/react";
import { getApiError, inventoryApi } from "@/api/client";
import { formatNumber } from "@/lib/utils";
import { PageHeader, ErrorBanner, FormField, SkeletonBlock } from "@/components/ui/FormField";
import { StatCard, StatusBadge } from "@/components/ui/StatCard";
import { Drawer } from "@/components/ui/Modal";
import { useTranslation } from "react-i18next";

export default function InventoryDetailPage() {
  const { t } = useTranslation("operate");
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const itemQ = useQuery({ queryKey: ["inventory-item", id], queryFn: () => inventoryApi.get(id), enabled: !!id });
  const [open, setOpen] = useState(false);
  const [move, setMove] = useState({ quantity: "", movement_type: "out", notes: "" });
  const mut = useMutation({
    mutationFn: () =>
      inventoryApi.move(id, {
        quantity: Number(move.quantity),
        movement_type: move.movement_type,
        notes: move.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-item", id] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false);
    },
  });
  const item = itemQ.data;
  if (itemQ.isLoading) {
    return (
      <Box>
        <SkeletonBlock />
      </Box>
    );
  }
  if (!item) {
    return (
      <Box>
        <ErrorBanner message={itemQ.error ? getApiError(itemQ.error) : "Item not found."} />
      </Box>
    );
  }
  return (
    <Box>
      <PageHeader
        title={item.name}
        subtitle={`${item.sku} · ${item.location}`}
        crumbs={
          <>
            <Link as={RouterLink} to="/inventory">
              Inventory
            </Link>
            <Text as="span" mx={1}>
              /
            </Text>
            <Text as="span">{item.name}</Text>
          </>
        }
        actions={
          <Button colorScheme="brand" onClick={() => setOpen(true)}>
            Record movement
          </Button>
        }
      />
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <StatCard label={t("inventory.onHand")} value={`${formatNumber(item.quantity, 1)} ${item.unit}`} />
        <StatCard label={t("inventory.reorderAt")} value={formatNumber(item.reorder_level, 1)} />
        <StatCard label={t("inventory.unitCost")} value={item.unit_cost != null ? `$${item.unit_cost}` : "—"} />
        <StatCard
          label={t("labels.status", { ns: "common" })}
          value={<StatusBadge status={item.quantity <= item.reorder_level ? "warning" : "healthy"} />}
        />
      </SimpleGrid>
      <Card as="section" variant="outline" borderColor="border.default" bg="bg.surface">
        <CardBody>
          <Text>
            Category <Text as="strong">{item.category.replace("_", " ")}</Text>
            {item.farm_name ? ` · Farm ${item.farm_name}` : ""}
          </Text>
          <Text color="fg.muted">{t("inventory.movementsHint")}</Text>
        </CardBody>
      </Card>
      <Drawer open={open} title={t("inventory.stockMovement")} onClose={() => setOpen(false)}>
        <FormField label={t("inventory.quantity")} htmlFor="qty">
          <Input id="qty" type="number" value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} />
        </FormField>
        <FormField label={t("inventory.type")} htmlFor="mtype">
          <Select id="mtype" value={move.movement_type} onChange={(e) => setMove({ ...move, movement_type: e.target.value })}>
            <option value="in">{t("inventory.receiptIn")}</option>
            <option value="out">{t("inventory.issueOut")}</option>
            <option value="adjust">{t("inventory.adjust")}</option>
            <option value="harvest">{t("inventory.harvest")}</option>
          </Select>
        </FormField>
        <FormField label={t("labels.notes", { ns: "common" })} htmlFor="mnotes">
          <Input id="mnotes" value={move.notes} onChange={(e) => setMove({ ...move, notes: e.target.value })} placeholder={t("inventory.movementPlaceholder")} />
        </FormField>
        <Button colorScheme="brand" isDisabled={mut.isPending} onClick={() => mut.mutate()}>
          Save movement
        </Button>
      </Drawer>
    </Box>
  );
}
