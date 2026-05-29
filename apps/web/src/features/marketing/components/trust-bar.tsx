import Link from "next/link";
import { Gift, Lock, ShieldCheck, Star } from "lucide-react";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";

const items = [
  { icon: ShieldCheck, label: "PMDC verified doctors" },
  {
    icon: Gift,
    label: "Free Sunday video consult",
    href: siteConfig.links.sundayConsult,
  },
  { icon: Lock, label: "Secure online video" },
  { icon: Star, label: "In-house care in Lahore" },
];

export function TrustBar() {
  return (
    <PageSection variant="accent" spacing="sm" flipBlur>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-14 sm:gap-y-6 lg:gap-x-16">
        {items.map(({ icon: Icon, label, href }) => {
          const content = (
            <>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium leading-snug text-slate-700 sm:text-base">
                {label}
              </span>
            </>
          );
          const rowClass =
            "flex min-h-[3.25rem] items-center gap-3 rounded-xl px-2 py-2 transition-colors sm:min-h-0 sm:rounded-none sm:px-0 sm:py-0";
          return href ? (
            <Link
              key={label}
              href={href}
              className={cn(rowClass, "hover:bg-white/60 hover:text-brand-dark active:bg-white/80 sm:hover:bg-transparent")}
            >
              {content}
            </Link>
          ) : (
            <div key={label} className={rowClass}>
              {content}
            </div>
          );
        })}
      </div>
    </PageSection>
  );
}
