import { JsonLd } from "@/components/seo/json-ld";
import type { FaqItem } from "@/lib/seo/schema";
import { buildFaqSchema } from "@/lib/seo/schema";

type FaqJsonLdProps = {
  items: FaqItem[];
};

export function FaqJsonLd({ items }: FaqJsonLdProps) {
  if (items.length === 0) return null;
  return <JsonLd data={buildFaqSchema(items)} />;
}
