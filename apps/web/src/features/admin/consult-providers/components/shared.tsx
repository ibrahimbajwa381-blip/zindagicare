"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, FileText, X } from "lucide-react";
import { cn, VerificationStatuses } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatDayOfWeek, humanize } from "@/features/admin/consult-providers/format";
import { VERIFICATION_STATUS_OPTIONS } from "@/features/admin/consult-providers/verification";

const AVATAR_SIZES = {
  sm: { box: "h-9 w-9 text-xs rounded-lg", px: "36px" },
  md: { box: "h-12 w-12 text-sm rounded-xl", px: "48px" },
  lg: { box: "h-16 w-16 text-base rounded-xl", px: "64px" },
  xl: { box: "h-24 w-24 text-xl rounded-2xl", px: "96px" },
} as const;

export function ProviderAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof AVATAR_SIZES;
}) {
  const { box, px } = AVATAR_SIZES[size];
  if (avatarUrl) {
    return (
      <span
        className={cn(
          "relative shrink-0 overflow-hidden bg-slate-100 shadow-sm ring-2 ring-white",
          box,
        )}
      >
        <Image
          src={avatarUrl}
          alt={name}
          fill
          className="object-cover object-top"
          sizes={px}
          unoptimized
        />
      </span>
    );
  }
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br from-brand/20 to-brand/40 font-semibold text-brand-dark shadow-sm ring-2 ring-white",
        box,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  [VerificationStatuses.APPROVED]: "bg-emerald-100 text-emerald-800",
  [VerificationStatuses.PENDING]: "bg-amber-100 text-amber-800",
  [VerificationStatuses.REJECTED]: "bg-red-100 text-red-700",
  restricted: "bg-orange-100 text-orange-800",
};

export function ProviderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700",
      )}
    >
      {status}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        accent ? "border-amber-200 bg-amber-50/60" : "border-slate-200/80 bg-white",
      )}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          accent ? "text-amber-900" : "text-slate-900",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function InfoBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  enabled,
  disabled,
  onToggle,
  enableLabel,
  disableLabel,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
  enableLabel: string;
  disableLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-slate-900">
          {title}{" "}
          <span
            className={cn(
              "ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600",
            )}
          >
            {enabled ? "On" : "Off"}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={onToggle}
        className="shrink-0"
      >
        {enabled ? disableLabel : enableLabel}
      </Button>
    </div>
  );
}

/** Dismissible error / success banner. */
export function NoticeBanner({
  error,
  notice,
  onDismiss,
}: {
  error?: string | null;
  notice?: string | null;
  onDismiss: () => void;
}) {
  if (!error && !notice) return null;
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm",
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
      role={error ? "alert" : "status"}
    >
      <p>{error ?? notice}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DocumentCard({
  label,
  url,
  image = false,
}: {
  label: string;
  url?: string;
  /** Always render as an image (avatar URLs don't always carry a file extension). */
  image?: boolean;
}) {
  const isImage = url && (image || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      {!url ? (
        <p className="mt-2 text-xs text-slate-500">Not uploaded</p>
      ) : (
        <div className="mt-3 space-y-3">
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className={cn(
                "w-full rounded-lg border border-slate-100 bg-slate-50 object-contain",
                image ? "h-56" : "max-h-40",
              )}
            />
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <FileText className="h-4 w-4" />
            {image ? "Open full size" : "Open document"}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

function ModalShell({
  titleId,
  title,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const MIN_REASON_LENGTH = 3;

/** Collects a rejection / restriction reason (3–500 chars, matching the API). */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  initialValue = "",
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  initialValue?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const reason = value.trim();
    if (reason.length < MIN_REASON_LENGTH) {
      setError(`Enter at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }
    onConfirm(reason);
  };

  return (
    <ModalShell titleId="provider-reason-title" title={title} onClose={onCancel}>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <Label htmlFor="provider-reason" className="mt-4 block">
        Reason
      </Label>
      <textarea
        id="provider-reason"
        autoFocus
        rows={4}
        maxLength={500}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={busy}
          className="bg-red-600 text-white hover:bg-red-700"
        >
          {busy ? "Saving…" : confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}

/** Type-the-name confirmation for removing a provider (soft delete). */
export function DeleteProviderDialog({
  name,
  providerLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  providerLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const submit = () => {
    if (value.trim().toLowerCase() !== name.trim().toLowerCase()) {
      setMismatch(true);
      return;
    }
    onConfirm();
  };

  return (
    <ModalShell
      titleId="provider-delete-title"
      title={`Remove ${providerLabel}`}
      onClose={onCancel}
    >
      <p className="mt-2 text-sm text-slate-600">
        This removes <strong>{name}</strong> from every listing and deactivates their account.
        Past consults, payouts and reviews are kept for records.
      </p>
      <p className="mt-3 text-sm text-slate-600">
        Type <strong>{name}</strong> to confirm:
      </p>
      <Input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMismatch(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={name}
        className="mt-2"
      />
      {(mismatch || error) && (
        <p className="mt-2 text-sm text-red-600">
          {mismatch ? "Name didn't match — please type it exactly as shown." : error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={busy}
          className="bg-red-600 text-white hover:bg-red-700"
        >
          {busy ? "Removing…" : "Remove permanently"}
        </Button>
      </div>
    </ModalShell>
  );
}

/** Read-only practice locations list. */
export function ClinicList({
  clinics,
}: {
  clinics: { name: string; city: string; area?: string; address?: string }[];
}) {
  if (clinics.length === 0) {
    return <p className="text-sm text-slate-500">No practice locations added.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {clinics.map((clinic, index) => (
        <li
          key={`${clinic.name}-${index}`}
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
        >
          <p className="font-medium text-slate-900">{clinic.name}</p>
          <p className="mt-0.5 text-slate-600">
            {[clinic.area, clinic.city].filter(Boolean).join(", ")}
          </p>
          {clinic.address && <p className="mt-0.5 text-xs text-slate-500">{clinic.address}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Read-only weekly consult hours, grouped by day. */
export function WeeklyAvailabilityList({
  slots,
}: {
  slots: { dayOfWeek: number; startTimeLocal: string; endTimeLocal: string }[];
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-slate-500">No availability windows set.</p>;
  }
  const sorted = [...slots].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTimeLocal.localeCompare(b.startTimeLocal),
  );
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
      {sorted.map((slot, index) => (
        <li key={`${slot.dayOfWeek}-${index}`} className="flex justify-between px-4 py-2.5">
          <span className="font-medium text-slate-900">{formatDayOfWeek(slot.dayOfWeek)}</span>
          <span className="tabular-nums text-slate-600">
            {slot.startTimeLocal} – {slot.endTimeLocal}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Status dropdown; shows the current non-selectable status (e.g. pending) disabled. */
export function VerificationStatusSelect({
  value,
  disabled,
  ariaLabel,
  compact,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  ariaLabel: string;
  compact?: boolean;
  onChange: (next: string) => void;
}) {
  const isKnown = VERIFICATION_STATUS_OPTIONS.some((option) => option.value === value);
  return (
    <div className="relative inline-flex shrink-0 items-center">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={cn(
          "appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 font-medium text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50",
          compact ? "py-1.5 text-xs" : "py-2 text-sm",
        )}
      >
        {!isKnown && (
          <option value={value} disabled>
            {humanize(value)}
          </option>
        )}
        {VERIFICATION_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
    </div>
  );
}
