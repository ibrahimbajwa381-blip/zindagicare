"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { CalendarCheck, Clock, ShieldCheck, Star, Video, X, Zap } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { ConsultReviewPaymentModal } from "@/features/consult/components/consult-review-payment-modal";
import {
  BookingDateStrip,
  BookingTimeGroups,
  describeDateKey,
  isSlotAvailable,
  type BookingSlot,
} from "@/features/consult/components/doctor-booking-picker";
import { JazzCashRedirectForm } from "@/features/consult/components/jazzcash-redirect-form";
import { usePaymentProviders } from "@/features/consult/hooks/use-payment-providers";
import type { PaymentProviderInput } from "@zindagi/validators";
import type { CheckoutResult } from "@/features/consult/types";
import type { PublicDoctorProfile } from "@/features/marketing/types/doctor-public";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { siteConfig } from "@/config/site";
import { surfaceCard, surfaceCardInteractive } from "@/lib/ui/surfaces";
import { getConsultSlotDateKey } from "@/lib/consult/slot-utils";
import { formatKarachiTime } from "@/lib/format/datetime";
import { useMounted } from "@/hooks/use-mounted";
import { useLocale } from "@/i18n/locale-provider";

type Props = {
  doctor: PublicDoctorProfile;
  callbackUrl: string;
};

/** Remembers the picked slot across the login redirect so the patient lands back on it. */
const pendingSlotKey = (doctorId: string) => `zc:pending-slot:${doctorId}`;

function DoctorAvatar({ name, avatarUrl, size = 56 }: { name: string; avatarUrl?: string; size?: number }) {
  const src = resolveDoctorPortrait(name, avatarUrl);
  const box = size === 56 ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-xl";
  if (src) {
    return (
      <span className={cn("relative shrink-0 overflow-hidden ring-1 ring-slate-200", box)}>
        <Image src={src} alt={name} fill className="object-cover object-top" sizes={`${size}px`} unoptimized />
      </span>
    );
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center bg-slate-100 text-sm font-semibold text-slate-600", box)}>
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

export function DoctorProfileBookingPanel({ doctor, callbackUrl }: Props) {
  const mounted = useMounted();
  const { locale } = useLocale();
  const { data: session, status } = useSession();
  const needsPhone = status === "authenticated" && session?.user?.hasPhone === false;
  const [phone, setPhone] = useState("");
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [patientNotes, setPatientNotes] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const reviewFromSheet = useRef(false);
  const { defaultProvider } = usePaymentProviders();
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderInput>(defaultProvider);
  const [gatewayRedirect, setGatewayRedirect] = useState<CheckoutResult["gatewayRedirect"] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    setPaymentProvider(defaultProvider);
  }, [defaultProvider]);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/v1/consult/slots?doctorId=${doctor.doctorId}`);
      const json = await res.json();
      if (!json.success) return;
      const loaded: BookingSlot[] = json.data.slots ?? [];
      setSlots(loaded);

      // Back from login: restore the slot the patient picked and reopen the sheet on it.
      let pending: string | null = null;
      try {
        pending = window.sessionStorage.getItem(pendingSlotKey(doctor.doctorId));
        window.sessionStorage.removeItem(pendingSlotKey(doctor.doctorId));
      } catch {
        // Storage blocked — fall through to the default day.
      }
      const restored = pending
        ? loaded.find((s) => s.slotId === pending && isSlotAvailable(s))
        : undefined;
      if (restored) {
        setSelectedDateKey(getConsultSlotDateKey(restored.slotId));
        setSelectedSlotId(restored.slotId);
        setSheetOpen(true);
        return;
      }

      // Default to the first day that actually has an open slot.
      const firstOpen = loaded
        .filter(isSlotAvailable)
        .map((s) => getConsultSlotDateKey(s.slotId))
        .sort()[0];
      const firstAny = loaded.map((s) => getConsultSlotDateKey(s.slotId)).sort()[0];
      setSelectedDateKey((current) => current ?? firstOpen ?? firstAny ?? null);
    } finally {
      setSlotsLoading(false);
    }
  }, [doctor.doctorId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // Every "Book consultation" link on the page (hero, closing CTA, mobile bar, section nav)
  // points at #book — open the focused booking sheet instead of scrolling to the sidebar.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href="#book"]');
      if (!link) return;
      event.preventDefault();
      setSheetOpen(true);
    };
    // Deep links such as /doctors/<slug>#book open straight into booking.
    const onHash = () => {
      if (window.location.hash === "#book") setSheetOpen(true);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    const initial = window.setTimeout(onHash, 0);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
      window.clearTimeout(initial);
    };
  }, []);

  const dateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const slot of slots) keys.add(getConsultSlotDateKey(slot.slotId));
    return [...keys].sort();
  }, [slots]);

  const availableByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slot of slots) {
      if (!isSlotAvailable(slot)) continue;
      const key = getConsultSlotDateKey(slot.slotId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [slots]);

  const nextAvailable = useMemo(
    () =>
      slots
        .filter(isSlotAvailable)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0],
    [slots],
  );

  const slotsForSelectedDate = useMemo(
    () => slots.filter((s) => getConsultSlotDateKey(s.slotId) === (selectedDateKey ?? "")),
    [slots, selectedDateKey],
  );

  const selectedSlot = slots.find((s) => s.slotId === selectedSlotId);

  const selectDate = (key: string) => {
    setSelectedDateKey(key);
    setSelectedSlotId(null);
  };

  const pickNextAvailable = () => {
    if (!nextAvailable) return;
    setSelectedDateKey(getConsultSlotDateKey(nextAvailable.slotId));
    setSelectedSlotId(nextAvailable.slotId);
  };

  const proceedToReview = (fromSheet: boolean) => {
    if (!selectedSlotId) return;
    if (status !== "authenticated") {
      try {
        window.sessionStorage.setItem(pendingSlotKey(doctor.doctorId), selectedSlotId);
      } catch {
        // Storage blocked — the patient just re-picks the slot after logging in.
      }
      window.location.href = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      return;
    }
    reviewFromSheet.current = fromSheet;
    setSheetOpen(false);
    setReviewOpen(true);
    setError(null);
  };

  const startCheckout = async () => {
    if (!selectedSlotId) return;
    if (needsPhone && !phone.trim()) {
      setError("Please add your mobile number to continue");
      return;
    }
    setLoading(true);
    setError(null);
    setGatewayRedirect(null);

    try {
      const res = await fetch("/api/v1/consult/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor.doctorId,
          slotId: selectedSlotId,
          patientNotes: patientNotes.trim() || undefined,
          locale,
          paymentProvider,
          phone: needsPhone ? phone.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Could not start checkout");
      }

      const checkout = json.data as CheckoutResult;

      const payUrl =
        checkout.manualTransfer?.payUrl ?? checkout.testPayment?.completeUrl;
      if (payUrl) {
        window.location.href = payUrl;
        return;
      }

      const redirect = checkout.gatewayRedirect ?? checkout.jazzcash;
      if (redirect) {
        setGatewayRedirect(redirect);
      } else {
        throw new Error("Payment unavailable");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const fee = `Rs. ${doctor.consultationFee.toLocaleString("en-PK")}`;
  const ctaLabel = !mounted
    ? "Loading…"
    : status === "authenticated"
      ? "Continue to payment"
      : "Log in to book";
  const selectionLabel =
    selectedSlot && selectedDateKey
      ? (() => {
          const day = describeDateKey(selectedDateKey);
          return `${day.label}, ${day.day} ${day.month} · ${formatKarachiTime(selectedSlot.startAt)}`;
        })()
      : null;

  const picker = (dense: boolean) => (
    <div className="space-y-4">
      {!slotsLoading && nextAvailable && nextAvailable.slotId !== selectedSlotId && (
        <button
          type="button"
          onClick={pickNextAvailable}
          disabled={loading || doctor.isFull}
          className="flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-left transition-colors hover:bg-emerald-50"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Zap className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-emerald-700">Next available</span>
            <span className="block truncate text-sm font-semibold text-slate-900">
              {describeDateKey(getConsultSlotDateKey(nextAvailable.slotId)).label},{" "}
              {formatKarachiTime(nextAvailable.startAt)}
            </span>
          </span>
          <span className="text-xs font-semibold text-emerald-700">Pick</span>
        </button>
      )}

      {dateKeys.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">1. Choose a day</p>
          <BookingDateStrip
            dateKeys={dateKeys}
            availableByDate={availableByDate}
            selectedDateKey={selectedDateKey}
            onSelect={selectDate}
          />
        </div>
      )}

      <div>
        {(slotsLoading || dateKeys.length > 0) && (
          <p className="mb-2 text-sm font-semibold text-slate-800">
            2. Pick a time{" "}
            <span className="font-normal text-slate-400">(PKT)</span>
          </p>
        )}
        <BookingTimeGroups
          slots={slotsForSelectedDate}
          selectedSlotId={selectedSlotId}
          onSelect={setSelectedSlotId}
          disabled={loading || doctor.isFull}
          loading={slotsLoading}
          emptyMessage={
            doctor.isFull || !dateKeys.length
              ? "No open slots in the next two weeks — check back soon."
              : "No times left on this day. Try another day."
          }
          dense={dense}
        />
      </div>
    </div>
  );

  const createAccountHint = mounted && status === "unauthenticated" && (
    <p className="text-center text-xs text-slate-500">
      New here?{" "}
      <Link href={siteConfig.links.register} className="font-medium text-brand">
        Create a free account
      </Link>{" "}
      — your selected time is kept.
    </p>
  );

  return (
    <>
      {gatewayRedirect && (
        <JazzCashRedirectForm
          actionUrl={gatewayRedirect.actionUrl}
          fields={gatewayRedirect.fields}
        />
      )}

      <ConsultReviewPaymentModal
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) {
            setError(null);
            // "Back" returns to the time picker the patient came from.
            if (reviewFromSheet.current) setSheetOpen(true);
          }
        }}
        doctorName={doctor.name}
        doctorSpecialty={doctor.specialties[0]}
        doctorAvatarUrl={doctor.avatarUrl}
        consultationFee={doctor.consultationFee}
        slotStartAt={selectedSlot?.startAt}
        slotFormatted={mounted}
        patientNotes={patientNotes}
        onPatientNotesChange={setPatientNotes}
        needsPhone={needsPhone}
        phone={phone}
        onPhoneChange={setPhone}
        loading={loading}
        error={error}
        paymentProvider={paymentProvider}
        onPaymentProviderChange={setPaymentProvider}
        onPay={startCheckout}
      />

      <BookingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        header={
          <div className="flex items-center gap-3 pr-12">
            <DoctorAvatar name={doctor.name} avatarUrl={doctor.avatarUrl} size={44} />
            <div className="min-w-0">
              <h2 className="line-clamp-2 font-display text-base font-semibold leading-snug text-foreground sm:text-lg">
                Book {doctor.name}
              </h2>
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Video className="h-3.5 w-3.5 text-brand" aria-hidden />
                  Video consultation
                </span>
                <span className="font-semibold text-brand-dark">{fee}</span>
              </p>
            </div>
          </div>
        }
        footer={
          <div className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                {selectionLabel ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Your appointment
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900">{selectionLabel}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Select a time to continue</p>
                )}
              </div>
              <Button
                variant="default"
                size="lg"
                className="w-full shrink-0 bg-brand text-white hover:bg-brand-dark sm:w-auto"
                disabled={!selectedSlotId || loading || doctor.isFull}
                onClick={() => proceedToReview(true)}
              >
                {ctaLabel}
              </Button>
            </div>
            {createAccountHint}
          </div>
        }
      >
        {picker(false)}
      </BookingSheet>

      <div
        className={cn(
          "overflow-hidden lg:sticky lg:top-[var(--profile-sticky-top,9rem)] lg:transition-[top] lg:duration-300 lg:ease-in-out",
          surfaceCardInteractive,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-brand-muted/40 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
              <CalendarCheck className="h-4 w-4 text-brand" aria-hidden />
              Book video consultation
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {doctor.isFull
                ? "No open slots — check back soon"
                : `${doctor.availableSlots} slots in the next 2 weeks`}
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="block whitespace-nowrap font-display text-xl font-semibold text-brand-dark">{fee}</span>
            <span className="whitespace-nowrap text-[11px] text-slate-500">per consultation</span>
          </p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <DoctorAvatar name={doctor.name} avatarUrl={doctor.avatarUrl} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{doctor.name}</p>
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <span className="truncate">{doctor.specialties[0]}</span>
                {doctor.ratingCount > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                    {doctor.ratingAvg.toFixed(1)} ({doctor.ratingCount})
                  </span>
                )}
              </p>
            </div>
          </div>

          {picker(true)}

          {selectionLabel && (
            <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <Clock className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 truncate font-medium">{selectionLabel}</span>
            </p>
          )}

          <Button
            variant="default"
            size="lg"
            className="w-full bg-brand text-white hover:bg-brand-dark"
            disabled={!selectedSlotId || loading || doctor.isFull}
            onClick={() => proceedToReview(false)}
          >
            {ctaLabel}
          </Button>

          {createAccountHint}

          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            Secure payment · Your slot is held during checkout
          </p>
        </div>
      </div>
    </>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens, with a pinned action footer. */
function BookingSheet({
  open,
  onClose,
  header,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    // Only lock scroll while open; the review modal manages its own lock when it takes over.
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Book a consultation"
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/55 backdrop:backdrop-blur-sm"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="flex h-full items-end justify-center sm:items-center sm:p-4">
        <div
          role="document"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-b-none rounded-t-3xl shadow-premium-lg sm:max-h-[88dvh] sm:rounded-3xl",
            surfaceCard,
          )}
        >
          <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
            <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200 sm:hidden" />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 active:scale-95"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {header}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            {children}
          </div>
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        </div>
      </div>
    </dialog>
  );
}
