"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@zindagi/shared";
import { useHideOnScroll } from "@/components/layout/use-hide-on-scroll";

export type ProfileNavItem = { id: string; label: string };

/**
 * Sticky in-page section nav for public doctor / physiotherapist portfolios. Highlights the
 * section currently in view and keeps the active pill scrolled into view on phones. When the
 * site header slides away on scroll (desktop only), the nav moves up into its place and
 * publishes the new offset as `--profile-sticky-top` so sticky sidebars follow it.
 */
export function ProfileSectionNav({ items }: { items: ProfileNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const listRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const headerHidden = useHideOnScroll();

  useEffect(() => {
    const scope = navRef.current?.parentElement;
    if (!scope) return;
    scope.style.setProperty("--profile-sticky-top", headerHidden ? "4.25rem" : "9rem");
  }, [headerHidden]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        // Topmost visible section wins, so short sections don't steal focus from the one being read.
        const first = items.find((item) => visible.has(item.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const list = listRef.current;
    const pill = list?.querySelector<HTMLElement>(`[data-nav="${active}"]`);
    if (!list || !pill) return;
    const target = pill.offsetLeft - list.clientWidth / 2 + pill.clientWidth / 2;
    list.scrollTo({ left: target, behavior: "smooth" });
  }, [active]);

  if (items.length < 3) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Profile sections"
      className={cn(
        "sticky top-16 z-20 -mx-4 border-y border-slate-200/80 bg-white px-4 py-2 sm:mx-0 sm:rounded-2xl sm:border sm:px-2 sm:shadow-sm",
        "sm:transition-[top,box-shadow] sm:duration-300 sm:ease-in-out sm:motion-reduce:transition-none",
        headerHidden ? "sm:top-2 sm:shadow-md" : "sm:top-[4.75rem]",
      )}
    >
      <div
        ref={listRef}
        className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            data-nav={item.id}
            aria-current={active === item.id ? "location" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active === item.id
                ? "bg-brand text-white shadow-sm"
                : "text-slate-600 hover:bg-brand-muted hover:text-brand-dark",
            )}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
