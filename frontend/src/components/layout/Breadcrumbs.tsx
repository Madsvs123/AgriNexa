import { Link as RouterLink, useLocation } from "react-router-dom";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, Text } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { breadcrumbsFor } from "@/navigation/manifest";
import { useNavLabels } from "@/navigation/useNav";
import { useDirection } from "@/i18n/useDirection";
import { usePageTitle } from "./PageTitleContext";

/**
 * Breadcrumbs derived from the route manifest's `parent` chain.
 *
 * The leaf label is replaced with the record's own name when a detail page
 * publishes one through `usePageTitle` — that is user data, so it is shown
 * verbatim and isolated for bidi rather than translated.
 */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const { title } = usePageTitle();
  const { labelFor } = useNavLabels();
  const { isRtl } = useDirection();
  const crumbs = breadcrumbsFor(pathname, labelFor, title ?? undefined);

  if (crumbs.length === 0) return null;

  // The separator points the way the text runs.
  const Separator = isRtl ? ChevronLeft : ChevronRight;

  return (
    <Breadcrumb
      spacing={1.5}
      separator={<Separator size={13} aria-hidden />}
      fontSize="sm"
      color="fg.muted"
      minW={0}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <BreadcrumbItem key={`${crumb.label}-${i}`} isCurrentPage={isLast} minW={0}>
            {crumb.path && !isLast ? (
              <BreadcrumbLink as={RouterLink} to={crumb.path} _hover={{ color: "brand.500" }}>
                {crumb.label}
              </BreadcrumbLink>
            ) : (
              <Text
                as="span"
                color={isLast ? "fg.default" : "fg.muted"}
                fontWeight={isLast ? "semibold" : "normal"}
                noOfLines={1}
                // Record names may be in a different script from the UI.
                dir={isLast && title ? "auto" : undefined}
              >
                {crumb.label}
              </Text>
            )}
          </BreadcrumbItem>
        );
      })}
    </Breadcrumb>
  );
}
