import { JsonLd } from "@/components/seo/json-ld";
import type { BreadcrumbItem } from "@/lib/seo/schema";
import { buildBreadcrumbSchema } from "@/lib/seo/schema";

type BreadcrumbJsonLdProps = {
  items: BreadcrumbItem[];
};

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  if (items.length === 0) return null;
  return <JsonLd data={buildBreadcrumbSchema(items)} />;
}
