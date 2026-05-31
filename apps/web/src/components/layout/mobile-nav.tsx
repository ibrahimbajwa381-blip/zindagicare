"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";

export type MobileNavLink = {
  href?: string;
  label: string;
  badge?: string;
  action?: "sign-out";
};

export type MobileNavSection = {
  title?: string;
  links: readonly MobileNavLink[];
};

type MobileNavProps = {
  links: readonly MobileNavLink[];
  sections?: readonly MobileNavSection[];
  footer?: React.ReactNode;
  className?: string;
  menuLabel?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
};

function MobileNavItem({
  item,
  onClose,
}: {
  item: MobileNavLink;
  onClose: () => void;
}) {
  const itemClassName =
    "flex min-h-[3rem] w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-brand-muted hover:text-brand-dark active:bg-brand-muted/80";

  if (item.action === "sign-out") {
    return (
      <button
        type="button"
        onClick={async () => {
          onClose();
          await signOut({ callbackUrl: siteConfig.links.login });
        }}
        className={cn(itemClassName, "text-left text-red-700 hover:bg-red-50 hover:text-red-800")}
      >
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <Link href={item.href ?? "#"} onClick={onClose} className={itemClassName}>
      <span>{item.label}</span>
      {item.badge && (
        <span className="shrink-0 rounded-md bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function MobileNav({
  links,
  sections = [],
  footer,
  className,
  menuLabel = "Menu",
  openMenuLabel = "Open menu",
  closeMenuLabel = "Close menu",
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  const toggle = () => setOpen((value) => !value);

  return (
    <div className={cn("shrink-0 md:hidden", className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors active:scale-[0.98]",
          open
            ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            : "border-brand-light/40 bg-brand-muted/60 text-brand-dark hover:border-brand-light hover:bg-brand-muted",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeMenuLabel : openMenuLabel}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>

      <div
        className={cn("fixed inset-0 z-[60]", open ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
          aria-label={closeMenuLabel}
          tabIndex={open ? 0 : -1}
          onClick={close}
        />

        <nav
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className={cn(
            "absolute right-0 top-0 flex h-full w-[min(100%,22rem)] flex-col border-l border-slate-200 bg-white shadow-premium-lg transition-transform duration-300 ease-out",
            "pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{menuLabel}</p>
            <button
              type="button"
              onClick={close}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-600 transition-colors hover:bg-slate-100 active:scale-[0.98]"
              aria-label={closeMenuLabel}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain bg-white px-3 py-2">
            <ul>
              {links.map((item) => (
                <li key={item.href ?? item.label}>
                  <MobileNavItem item={item} onClose={close} />
                </li>
              ))}
            </ul>

            {sections.map((section) => (
              <div key={section.title ?? section.links[0]?.label} className="mt-4">
                {section.title ? (
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </p>
                ) : null}
                <ul>
                  {section.links.map((item) => (
                    <li key={item.href ?? item.label}>
                      <MobileNavItem item={item} onClose={close} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {footer ? (
            <div className="shrink-0 space-y-2 border-t border-slate-100 bg-white px-4 py-4">
              {footer}
            </div>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
