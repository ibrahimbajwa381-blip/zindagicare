"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { cn, type Role } from "@zindagi/shared";
import { HeaderIconButton } from "@/components/layout/header-icon-button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "@/i18n/locale-provider";
import { resolveNotificationHref } from "@/lib/notifications/resolve-notification-href";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

type HeaderNotificationsMenuProps = {
  count: number;
  onCountChange?: () => void;
};

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function HeaderNotificationsMenu({
  count,
  onCountChange,
}: HeaderNotificationsMenuProps) {
  const t = useTranslations();
  const router = useRouter();
  const { data: session } = useSession();
  const roles = (session?.user?.roles ?? []) as Role[];
  const labels = t.header.actions;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncLayout = () => setIsMobile(mediaQuery.matches);
    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);
    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    fetch("/api/v1/notifications")
      .then(async (res) => {
        if (!res.ok) return [];
        const json = (await res.json()) as {
          success: boolean;
          data?: NotificationItem[];
        };
        return json.data ?? [];
      })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (
        isMobile &&
        (target as Element).closest?.(`[data-notifications-panel="${menuId}"]`)
      ) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isMobile, menuId]);

  async function markRead(notificationId: string) {
    await fetch(`/api/v1/notifications/${notificationId}/read`, {
      method: "PATCH",
    }).catch(() => undefined);
    setItems((current) =>
      current.map((item) =>
        item.id === notificationId
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
    onCountChange?.();
  }

  async function markAllRead() {
    await fetch("/api/v1/notifications/read-all", { method: "PATCH" }).catch(
      () => undefined,
    );
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    );
    onCountChange?.();
  }

  async function handleNotificationClick(item: NotificationItem) {
    if (!item.readAt) {
      await markRead(item.id);
    }

    const href = resolveNotificationHref(item.payload, roles);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  const panel = open ? (
    <div
      id={menuId}
      role="menu"
      data-notifications-panel={menuId}
      className={cn(
        "z-[60] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-premium-lg",
        isMobile
          ? "fixed inset-x-4 top-[calc(4rem+env(safe-area-inset-top,0px)+0.5rem)] sm:top-[calc(4.75rem+env(safe-area-inset-top,0px)+0.5rem)]"
          : "absolute right-0 top-[calc(100%+0.5rem)] w-[min(100vw-2rem,22rem)]",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{labels.notifications}</p>
          <p className="text-xs text-slate-500">{labels.notificationsHint}</p>
        </div>
        {count > 0 ? (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-muted"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            {labels.markAllRead}
          </button>
        ) : null}
      </div>

      <div className="max-h-[min(24rem,calc(100dvh-6rem-env(safe-area-inset-top,0px)))] overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center px-4 py-10">
            <Spinner size="md" label={labels.loadingNotifications} />
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            {labels.noNotifications}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const unread = !item.readAt;
              const href = resolveNotificationHref(item.payload, roles);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleNotificationClick(item)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100",
                      unread && "bg-brand-muted/30",
                      href && "cursor-pointer",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        {href ? (
                          <ExternalLink
                            className="h-3.5 w-3.5 text-slate-400"
                            aria-hidden
                          />
                        ) : null}
                        {unread ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                        ) : null}
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {item.body}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  ) : null;

  const mobileOverlay =
    open && isMobile ? (
      <button
        type="button"
        aria-label={t.common.closeMenu}
        className="fixed inset-0 z-[55] bg-slate-900/30"
        onClick={() => setOpen(false)}
      />
    ) : null;

  return (
    <div ref={containerRef} className="relative">
      <HeaderIconButton
        icon={Bell}
        label={labels.notifications}
        count={count}
        active={open}
        onClick={() => setOpen((value) => !value)}
      />

      {mounted && isMobile && open
        ? createPortal(
            <>
              {mobileOverlay}
              {panel}
            </>,
            document.body,
          )
        : panel}
    </div>
  );
}
