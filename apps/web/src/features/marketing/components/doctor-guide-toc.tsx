"use client";

import { cn } from "@zindagi/shared";
import { useHideOnScroll } from "@/components/layout/use-hide-on-scroll";

const TOC = [
  { href: "#demo", label: "Demo video" },
  { href: "#earnings", label: "Earnings" },
  { href: "#join", label: "How to join" },
  { href: "#workspace", label: "How to use" },
  { href: "#attendance", label: "Attendance" },
  { href: "#faq", label: "FAQ" },
] as const;

export function DoctorGuideToc() {
  const hidden = useHideOnScroll();

  return (
    <nav
      aria-label="On this page"
      className={cn(
        "z-30 border-b border-slate-200/90 bg-white/95",
        "max-md:relative",
        "md:sticky md:top-[4.75rem] md:transition-transform md:duration-300 md:ease-in-out md:motion-reduce:transition-none",
        hidden && "md:pointer-events-none md:-translate-y-[calc(100%+4.75rem)]",
      )}
    >
      <div className="mx-auto flex max-w-[100rem] gap-2 overflow-x-auto px-4 py-3 sm:px-8 lg:px-14">
        {TOC.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand/40 hover:bg-brand-muted hover:text-brand-dark"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
