"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { useTranslations } from "@/i18n/locale-provider";

export type AppUserMenuProps = {
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  dashboardHref?: string;
  className?: string;
  variant?: "header" | "drawer";
};

function profileInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function contactLine(email?: string | null, phone?: string | null) {
  const trimmedEmail = email?.trim();
  if (trimmedEmail) return trimmedEmail;
  const trimmedPhone = phone?.trim();
  if (trimmedPhone) return trimmedPhone;
  return null;
}

export function AppUserMenu({
  name,
  email,
  phone,
  city,
  dashboardHref = siteConfig.links.dashboard,
  className,
  variant = "header",
}: AppUserMenuProps) {
  const t = useTranslations();
  const labels = t.dashboard.header;
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const initials = profileInitials(name) || "?";
  const secondary = contactLine(email, phone);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    setOpen(false);
    await signOut({ callbackUrl: siteConfig.links.login });
  }

  const isDrawer = variant === "drawer";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 pl-1.5 pr-2.5 text-left shadow-sm transition-colors",
          "hover:border-brand-light/50 hover:bg-brand-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/40",
          open && "border-brand-light/50 bg-brand-muted/50",
          isDrawer ? "w-full max-w-none" : "max-w-[min(100%,16rem)]",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-white"
          aria-hidden
        >
          {initials}
        </span>
        <span className={cn("min-w-0 flex-1 flex-col", isDrawer ? "flex" : "hidden sm:flex")}>
          <span className="truncate text-sm font-semibold text-slate-800">{name}</span>
          {secondary ? (
            <span className="truncate text-xs text-slate-500">{secondary}</span>
          ) : (
            <span className="text-xs text-slate-500">{labels.patientAccount}</span>
          )}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute z-50 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-premium-lg",
            isDrawer
              ? "left-0 right-0 top-[calc(100%+0.5rem)] w-full"
              : "right-0 top-[calc(100%+0.5rem)] w-[min(100vw-2rem,18rem)]",
          )}
        >
          <div className="border-b border-slate-100 bg-gradient-to-br from-brand-muted/80 via-white to-white px-4 py-4">
            <div className="flex items-start gap-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-white"
                aria-hidden
              >
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{name}</p>
                {email?.trim() ? (
                  <p className="mt-0.5 truncate text-xs text-slate-600">{email.trim()}</p>
                ) : null}
                {phone?.trim() ? (
                  <p className="mt-0.5 truncate text-xs text-slate-600">{phone.trim()}</p>
                ) : null}
                <span className="mt-2 inline-flex rounded-full border border-brand-light/40 bg-brand-muted/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
                  {labels.patientAccount}
                </span>
                {city?.trim() ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {labels.city}: {city.trim()}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="p-1.5">
            <Link
              href={dashboardHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-muted hover:text-brand-dark"
            >
              <LayoutDashboard className="size-4 shrink-0 text-brand" aria-hidden />
              {labels.myDashboard}
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              {signingOut ? labels.signingOut : labels.signOut}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
