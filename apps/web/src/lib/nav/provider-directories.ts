import { siteConfig } from "@/config/site";

export type ProviderDirectoryLabels = {
  doctors: string;
  nurses: string;
  physiotherapists: string;
  herbalists: string;
  nutritionists: string;
};

/** Public directories for the five provider roles, in display order. */
export function providerDirectoryLinks(labels: ProviderDirectoryLabels) {
  return [
    { href: siteConfig.links.doctors, label: labels.doctors },
    { href: siteConfig.links.nurses, label: labels.nurses },
    { href: siteConfig.links.physiotherapists, label: labels.physiotherapists },
    { href: siteConfig.links.herbalists, label: labels.herbalists },
    { href: siteConfig.links.nutritionists, label: labels.nutritionists },
  ];
}
