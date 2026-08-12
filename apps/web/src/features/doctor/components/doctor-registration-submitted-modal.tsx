"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { surfaceCard } from "@/lib/ui/surfaces";

type Props = {
  open: boolean;
};

export function DoctorRegistrationSubmittedModal({ open: initiallyOpen }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    setOpen(initiallyOpen);
  }, [initiallyOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (dialog.open) {
      dialog.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function clearSubmittedQuery() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("submitted");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function handleClose() {
    setOpen(false);
    clearSubmittedQuery();
  }

  if (!initiallyOpen && !open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/50"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
    >
      <div className="flex h-full min-h-0 items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={cn(
            "relative w-full max-w-md overflow-hidden rounded-t-3xl p-6 shadow-premium-lg sm:rounded-3xl sm:p-8",
            surfaceCard,
          )}
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </span>

          <h2 className="mt-4 text-center font-display text-xl font-semibold text-slate-900">
            You&apos;re registered
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
            Thanks for submitting your credentials. Our team will verify your profile,
            and it typically goes live within one day. You can edit your profile anytime
            while you wait.
          </p>

          <Button type="button" className="mt-6 w-full" onClick={handleClose}>
            Got it
          </Button>
        </div>
      </div>
    </dialog>
  );
}
