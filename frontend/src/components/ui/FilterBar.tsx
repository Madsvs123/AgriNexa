import type { ReactNode } from "react";
import {
  Button,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Tag,
  TagLabel,
} from "@chakra-ui/react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Shared filter row for list pages, with an active-filter count and a reset.
 * Values are owned by `useUrlFilters`, so filtered views stay linkable.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  activeCount = 0,
  onReset,
  children,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  activeCount?: number;
  onReset?: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation("common");

  return (
    <Flex gap={3} wrap="wrap" align="center">
      {onSearchChange ? (
        <InputGroup maxW="320px" flex="1 1 220px">
          <InputLeftElement pointerEvents="none" color="fg.muted">
            <Search size={15} aria-hidden />
          </InputLeftElement>
          <Input
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? t("actions.search")}
            aria-label={searchLabel ?? t("actions.search")}
            bg="bg.surface"
          />
        </InputGroup>
      ) : null}

      {children}

      {activeCount > 0 ? (
        <>
          <Tag size="sm" colorScheme="brand" borderRadius="full">
            <TagLabel>{t("table.filterCount", { count: activeCount })}</TagLabel>
          </Tag>
          {onReset ? (
            <Button
              size="sm"
              variant="ghost"
              colorScheme="gray"
              leftIcon={<X size={14} />}
              onClick={onReset}
            >
              {t("actions.clear")}
            </Button>
          ) : null}
        </>
      ) : null}
    </Flex>
  );
}

/** Select styled to sit in a `FilterBar`. */
export function FilterSelect({
  value,
  onChange,
  label,
  options,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Array<[string, string]>;
  allLabel: string;
}) {
  return (
    <Select
      maxW="200px"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      bg="bg.surface"
    >
      <option value="">{allLabel}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </Select>
  );
}
