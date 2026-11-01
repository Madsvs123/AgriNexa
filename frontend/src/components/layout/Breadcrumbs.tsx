import { Link as RouterLink, useLocation } from "react-router-dom";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { breadcrumbsFor } from "@/navigation/manifest";
import { usePageTitle } from "./PageTitleContext";

/**
 * Breadcrumbs derived from the route manifest's `parent` chain.
 *
 * Only two pages used to hand-roll crumbs; every page gets them now, and the
 * leaf label is replaced with the record's real name when a detail page
 * publishes one through `usePageTitle`.
 */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const { title } = usePageTitle();
  const crumbs = breadcrumbsFor(pathname, title ?? undefined);

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb
      spacing={1.5}
      separator={<ChevronRight size={13} aria-hidden />}
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
