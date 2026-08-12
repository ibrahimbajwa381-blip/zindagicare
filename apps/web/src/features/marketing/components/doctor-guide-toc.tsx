"use client";

import { useEffect, useRef, useState } from "react";
import {
  CircleHelp,
  Clock,
  LayoutDashboard,
  UserPlus,
  Video,
  Wallet,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { useHideOnScroll } from "@/components/layout/use-hide-on-scroll";

const TOC = [
  { href: "#demo", id: "demo", label: "Demo video", short: "Demo", icon: Video },
  { href: "#earnings", id: "earnings", label: "Earnings", short: "Earnings", icon: Wallet },
  { href: "#join", id: "join", label: "How to join", short: "Join", icon: UserPlus },
  { href: "#workspace", id: "workspace", label: "How to use", short: "Use", icon: LayoutDashboard },
  { href: "#attendance", id: "attendance", label: "Attendance", short: "Attend", icon: Clock },
  { href: "#faq", id: "faq", label: "FAQ", short: "FAQ", icon: CircleHelp },
] as const;

const MOBILE_HEADER_OFFSET_PX = "64px";

export function DoctorGuideToc() {
  const headerHidden = useHideOnScroll();
  const [activeId, setActiveId] = useState<string>("demo");
  const [mobilePinned, setMobilePinned] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = TOC.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.25, 0.5] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const media = window.matchMedia("(max-width: 639px)");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!media.matches) {
          setMobilePinned(false);
          return;
        }
        setMobilePinned(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: `-${MOBILE_HEADER_OFFSET_PX} 0px 0px 0px`,
      },
    );

    observer.observe(sentinel);

    const onChange = () => {
      if (!media.matches) setMobilePinned(false);
    };
    media.addEventListener("change", onChange);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-0 sm:hidden" aria-hidden />
      <nav
        aria-label="On this page"
        className={cn(
          "z-40 border-b border-slate-200/90 bg-white",
          mobilePinned &&
            "max-sm:fixed max-sm:inset-x-0 max-sm:top-[calc(4rem+env(safe-area-inset-top,0px))] max-sm:shadow-sm",
          "sm:sticky sm:transition-[top,box-shadow] sm:duration-300 sm:ease-in-out sm:motion-reduce:transition-none",
          headerHidden
            ? "sm:top-0 sm:shadow-sm"
            : "sm:top-[calc(4.75rem+env(safe-area-inset-top,0px))] sm:shadow-none",
        )}
      >
        <ul className="mx-auto flex max-w-[100rem] items-stretch justify-between gap-0.5 overflow-x-auto px-1 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden">
          {TOC.map((item) => {
            const Icon = item.icon;
            const active = activeId === item.id;

            return (
              <li key={item.href} className="min-w-0 flex-1">
                <a
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "relative flex w-full flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors",
                    active
                      ? "text-brand"
                      : "text-slate-600 hover:bg-slate-100 hover:text-brand active:bg-slate-200",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-full",
                      active ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-700",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="max-w-full truncate text-[9px] font-medium leading-none">
                    {item.short}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mx-auto hidden max-w-[100rem] gap-2 overflow-x-auto px-4 py-3 sm:flex sm:px-8 lg:px-14">
          {TOC.map((item) => {
            const active = activeId === item.id;
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-brand/30 bg-brand-muted text-brand-dark"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand/40 hover:bg-brand-muted hover:text-brand-dark",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
      {mobilePinned ? <div className="h-14 sm:hidden" aria-hidden /> : null}
    </>
  );
}
