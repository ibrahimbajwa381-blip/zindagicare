"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  CalendarHeart,
  ChevronRight,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  UserPlus,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
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

function navItemIcon(item: MobileNavLink): LucideIcon {
  if (item.action === "sign-out") return LogOut;
  if (item.href?.includes("sunday")) return CalendarHeart;
  if (item.href?.includes("home-services")) return Home;
  if (item.href?.includes("doctors")) return Video;
  if (item.href?.includes("login")) return LogIn;
  if (item.href?.includes("register")) return UserPlus;
  if (
    item.href?.includes("dashboard") ||
    item.href?.includes("doctor") ||
    item.href?.includes("admin")
  ) {
    return LayoutDashboard;
  }
  return ChevronRight;
}

function MobileNavItem({
  item,
  onClose,
  animate,
  delayMs,
}: {
  item: MobileNavLink;
  onClose: () => void;
  animate: boolean;
  delayMs: number;
}) {
  const Icon = navItemIcon(item);
  const isSignOut = item.action === "sign-out";

  const itemClassName = cn(
    "group flex min-h-[3.35rem] w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left text-[0.95rem] font-medium transition-all duration-200",
    "hover:bg-gradient-to-r hover:from-brand-muted/90 hover:to-brand-muted/20 hover:pl-4 active:scale-[0.99]",
    isSignOut
      ? "text-red-700 hover:from-red-50 hover:to-red-50/40 hover:text-red-800"
      : "text-slate-700 hover:text-brand-dark",
    animate && "mobile-menu-item-animate opacity-0",
  );

  const content = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 transition-transform duration-200 group-hover:scale-105",
          isSignOut
            ? "bg-red-50 text-red-600 ring-red-100"
            : "bg-gradient-to-br from-brand-muted to-white text-brand-dark ring-brand-light/35",
        )}
        aria-hidden
      >
        <Icon className="size-[1.125rem]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="shrink-0 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          {item.badge}
        </span>
      ) : !isSignOut ? (
        <ChevronRight
          className="size-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand"
          aria-hidden
        />
      ) : null}
    </>
  );

  if (isSignOut) {
    return (
      <button
        type="button"
        onClick={async () => {
          onClose();
          await signOut({ callbackUrl: siteConfig.links.login });
        }}
        className={itemClassName}
        style={animate ? { animationDelay: `${delayMs}ms` } : undefined}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href ?? "#"}
      onClick={onClose}
      className={itemClassName}
      style={animate ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {content}
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
  const [mounted, setMounted] = useState(false);
  const [animateItems, setAnimateItems] = useState(false);
  const panelId = useId();

  const sectionLinks = sections.flatMap((section) => section.links);
  const allItems = [...links, ...sectionLinks];
  const footerDelayMs = 80 + allItems.length * 55 + 40;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setAnimateItems(false);
      return;
    }

    const frame = requestAnimationFrame(() => setAnimateItems(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

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

  let itemIndex = 0;

  const drawer = (
    <div
      className={cn("fixed inset-0 z-[60]", open ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-slate-900/55 backdrop-blur-md transition-all duration-300 ease-out",
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
          "absolute right-0 top-0 flex h-full w-[min(88vw,24rem)] min-h-0 flex-col border-l border-white/60 bg-white/95 shadow-premium-lg backdrop-blur-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="relative shrink-0 overflow-hidden border-b border-slate-100/80 px-5 py-4">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand-muted/80 via-brand-muted/20 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-brand/15 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark/70">
                ZindagiCare
              </p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">{menuLabel}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex size-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition-all hover:border-brand-light/50 hover:bg-brand-muted/40 hover:text-brand-dark active:scale-95"
              aria-label={closeMenuLabel}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <ul className="space-y-1">
            {links.map((item) => {
              const delayMs = 80 + itemIndex * 55;
              itemIndex += 1;
              return (
                <li key={item.href ?? item.label}>
                  <MobileNavItem
                    item={item}
                    onClose={close}
                    animate={animateItems}
                    delayMs={delayMs}
                  />
                </li>
              );
            })}
          </ul>

          {sections.map((section) => (
            <div key={section.title ?? section.links[0]?.label} className="mt-3">
              {section.title ? (
                <p
                  className={cn(
                    "px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400",
                    animateItems && "mobile-menu-item-animate opacity-0",
                  )}
                  style={animateItems ? { animationDelay: `${80 + itemIndex * 55}ms` } : undefined}
                >
                  {section.title}
                </p>
              ) : section.links.length > 0 ? (
                <div
                  className={cn(
                    "mx-3 mb-2 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent",
                    animateItems && "mobile-menu-item-animate opacity-0",
                  )}
                  style={animateItems ? { animationDelay: `${80 + itemIndex * 55}ms` } : undefined}
                  aria-hidden
                />
              ) : null}
              <ul className="space-y-1">
                {section.links.map((item) => {
                  const delayMs = 80 + itemIndex * 55;
                  itemIndex += 1;
                  return (
                    <li key={item.href ?? item.label}>
                      <MobileNavItem
                        item={item}
                        onClose={close}
                        animate={animateItems}
                        delayMs={delayMs}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {footer ? (
          <div
            className={cn(
              "shrink-0 border-t border-slate-100/80 bg-gradient-to-t from-brand-muted/30 to-white/80 px-4 py-4",
              animateItems && "mobile-menu-rise-animate opacity-0",
            )}
            style={animateItems ? { animationDelay: `${footerDelayMs}ms` } : undefined}
          >
            <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-3 shadow-sm backdrop-blur-sm">
              {footer}
            </div>
          </div>
        ) : null}
      </nav>
    </div>
  );

  return (
    <div className={cn("shrink-0 md:hidden", className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition-all duration-200 active:scale-95",
          open
            ? "border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50"
            : "border-brand-light/40 bg-brand-muted/60 text-brand-dark hover:border-brand-light hover:bg-brand-muted hover:shadow-md",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeMenuLabel : openMenuLabel}
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      {mounted ? createPortal(drawer, document.body) : null}
    </div>
  );
}
