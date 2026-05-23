import Link from "next/link";
import { Gift, Lock, ShieldCheck, Star } from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";

const items = [
  { icon: ShieldCheck, label: "PMDC verified doctors" },
  {
    icon: Gift,
    label: "Free Sunday video consult",
    href: siteConfig.links.sundayConsult,
  },
  { icon: Lock, label: "Secure & private" },
  { icon: Star, label: "Trusted by patients in Lahore" },
];

export function TrustBar() {
  return (
    <PageSection variant="accent" spacing="sm" flipBlur>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14 lg:gap-x-16">
        {items.map(({ icon: Icon, label, href }) => {
          const content = (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-slate-700 sm:text-base">
                {label}
              </span>
            </>
          );
          return href ? (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 transition-colors hover:text-brand-dark"
            >
              {content}
            </Link>
          ) : (
            <div key={label} className="flex items-center gap-3">
              {content}
            </div>
          );
        })}
      </div>
    </PageSection>
  );
}
