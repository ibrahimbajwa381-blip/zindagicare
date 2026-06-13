"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@zindagi/shared";
import { HeaderIconButton } from "@/components/layout/header-icon-button";
import { useTranslations } from "@/i18n/locale-provider";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
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
  const labels = t.header.actions;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  return (
    <div ref={containerRef} className="relative">
      <HeaderIconButton
        icon={Bell}
        label={labels.notifications}
        count={count}
        active={open}
        onClick={() => setOpen((value) => !value)}
      />

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-premium-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{labels.notifications}</p>
              <p className="text-xs text-slate-500">{labels.notificationsHint}</p>
            </div>
            {count > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-muted"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                {labels.markAllRead}
              </button>
            ) : null}
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                {labels.loadingNotifications}
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                {labels.noNotifications}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => {
                  const unread = !item.readAt;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          if (unread) void markRead(item.id);
                        }}
                        className={cn(
                          "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                          unread && "bg-brand-muted/30",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                          {unread ? (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                          ) : null}
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
      ) : null}
    </div>
  );
}
