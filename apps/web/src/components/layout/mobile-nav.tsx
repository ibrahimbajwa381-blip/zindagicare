"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@zindagi/shared";

export type MobileNavLink = {
  href: string;
  label: string;
  badge?: string;
};

type MobileNavProps = {
  links: readonly MobileNavLink[];
  footer?: React.ReactNode;
  className?: string;
};

export function MobileNav({ links, footer, className }: MobileNavProps) {
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

  return (
    <div className={cn("md:hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm transition-colors hover:border-brand-light/40 hover:bg-brand-muted active:scale-[0.98]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-[60] transition-opacity duration-200",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          onClick={close}
        />

        <nav
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className={cn(
            "absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-slate-200/80 bg-white shadow-premium-lg transition-transform duration-300 ease-out",
            "pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Menu</p>
            <button
              type="button"
              onClick={close}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 active:scale-[0.98]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <ul className="flex-1 overflow-y-auto overscroll-contain px-3 py-2">
            {links.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  className="flex min-h-[3rem] items-center justify-between gap-3 rounded-xl px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-brand-muted hover:text-brand-dark active:bg-brand-muted/80"
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="shrink-0 rounded-md bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {footer ? (
            <div className="shrink-0 space-y-2 border-t border-slate-100 px-4 py-4">
              {footer}
            </div>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
