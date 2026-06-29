"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import {
  workspaceForDashboardHref,
  type DashboardMenuLink,
} from "@/lib/nav/header-actions";
import { cn, type Workspace } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { useTranslations } from "@/i18n/locale-provider";

export type AccountType = "patient" | "doctor" | "nurse" | "admin";

export type AppUserMenuProps = {
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  image?: string | null;
  dashboardHref?: string;
  dashboardLinks?: DashboardMenuLink[];
  accountType?: AccountType;
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

/** Hide values that are still encrypted ciphertext (e.g. from a stale session token). */
function plainText(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.startsWith("enc:v1:")) return null;
  return trimmed;
}

function contactLine(email?: string | null, phone?: string | null) {
  return plainText(email) ?? plainText(phone) ?? null;
}

function accountLabel(
  labels: {
    patientAccount: string;
    doctorAccount: string;
    nurseAccount: string;
    adminAccount: string;
  },
  accountType: AccountType,
) {
  if (accountType === "doctor") return labels.doctorAccount;
  if (accountType === "nurse") return labels.nurseAccount;
  if (accountType === "admin") return labels.adminAccount;
  return labels.patientAccount;
}

export function AppUserMenu({
  name,
  email,
  phone,
  city,
  image,
  dashboardHref = siteConfig.links.dashboard,
  dashboardLinks,
  accountType = "patient",
  className,
  variant = "header",
}: AppUserMenuProps) {
  const t = useTranslations();
  const router = useRouter();
  const { data: session, update } = useSession();
  const labels = t.dashboard.header;
  const accountTypeLabel = accountLabel(labels, accountType);
  const menuDashboardLinks: DashboardMenuLink[] =
    dashboardLinks ??
    [
      {
        href: dashboardHref,
        label: labels.myDashboard,
        workspace: workspaceForDashboardHref(dashboardHref),
      },
    ];
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingDashboard, setSwitchingDashboard] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const initials = profileInitials(name) || "?";
  const displayEmail = plainText(email);
  const displayPhone = plainText(phone);
  const secondary = contactLine(email, phone);
  const avatarUrl = image?.trim() || null;
  const showImage = Boolean(avatarUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

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

  async function handleDashboardNav(href: string, workspace: Workspace) {
    setOpen(false);
    setSwitchingDashboard(true);
    try {
      if (session?.user?.activeWorkspace !== workspace) {
        await update({ activeWorkspace: workspace });
      }
      router.push(href);
      router.refresh();
    } finally {
      setSwitchingDashboard(false);
    }
  }

  const isDrawer = variant === "drawer";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          isDrawer
            ? "flex h-10 w-full max-w-none items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 pl-1.5 pr-2.5 text-left shadow-sm transition-colors hover:border-brand-light/50 hover:bg-brand-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/40"
            : "group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/50",
          className,
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-white",
            isDrawer
              ? "size-8 rounded-lg"
              : "size-9 shadow-sm transition-[transform,box-shadow,filter] group-hover:scale-[1.04] group-hover:brightness-110 group-hover:shadow-md group-active:scale-[0.98]",
            !isDrawer && open && "ring-2 ring-brand-light/70 ring-offset-2",
          )}
          aria-hidden
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl as string}
              alt=""
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            initials
          )}
        </span>
        {isDrawer ? (
          <>
            <span className="min-w-0 flex-1 flex-col flex">
              <span className="truncate text-sm font-semibold text-slate-800">{name}</span>
              {secondary ? (
                <span className="truncate text-xs text-slate-500">{secondary}</span>
              ) : (
                <span className="text-xs text-slate-500">{accountTypeLabel}</span>
              )}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-slate-500 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </>
        ) : (
          <span className="sr-only">{name}</span>
        )}
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
                className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-white"
                aria-hidden
              >
                {showImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl as string}
                    alt=""
                    className="size-full object-cover"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{name}</p>
                {displayEmail ? (
                  <p className="mt-0.5 truncate text-xs text-slate-600">{displayEmail}</p>
                ) : null}
                {displayPhone ? (
                  <p className="mt-0.5 truncate text-xs text-slate-600">{displayPhone}</p>
                ) : null}
                <span className="mt-2 inline-flex rounded-full border border-brand-light/40 bg-brand-muted/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
                  {accountTypeLabel}
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
            {menuDashboardLinks.map((link) => (
              <button
                key={link.href}
                type="button"
                role="menuitem"
                disabled={switchingDashboard}
                onClick={() => void handleDashboardNav(link.href, link.workspace)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-muted hover:text-brand-dark disabled:opacity-60"
              >
                {link.label === labels.adminDashboard ? (
                  <ShieldCheck className="size-4 shrink-0 text-brand" aria-hidden />
                ) : (
                  <LayoutDashboard className="size-4 shrink-0 text-brand" aria-hidden />
                )}
                {link.label}
              </button>
            ))}
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
