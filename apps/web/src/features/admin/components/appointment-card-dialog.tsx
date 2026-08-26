"use client";

import { useRef, useState } from "react";
import { Download, Loader2, MessageCircle, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AppointmentCard,
  APPT_CARD_HEIGHT,
  APPT_CARD_WIDTH,
  type AppointmentCardProps,
} from "./appointment-card";

type Contact = { name: string; phone?: string };

type Props = {
  card: AppointmentCardProps;
  patient: Contact;
  doctor: Contact;
  onClose: () => void;
};

function waHref(phone: string | undefined, text: string) {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d]/g, "");
  const withCountry = digits.startsWith("92") ? digits : `92${digits.replace(/^0/, "")}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

export function AppointmentCardDialog({ card, patient, doctor, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileName = `appointment-${patient.name.replace(/\s+/g, "-").toLowerCase()}.png`;

  const summaryText = `ZindagiCare appointment confirmed for ${patient.name} with ${doctor.name} on ${card.dateLabel} at ${card.timeLabel} (${card.type.replace(/_/g, " ")}).`;

  async function renderPng(): Promise<Blob> {
    const { toBlob } = await import("html-to-image");
    if (!cardRef.current) throw new Error("Card not ready");
    const blob = await toBlob(cardRef.current, {
      width: APPT_CARD_WIDTH,
      height: APPT_CARD_HEIGHT,
      pixelRatio: 2,
      cacheBust: true,
    });
    if (!blob) throw new Error("Could not generate image");
    return blob;
  }

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const blob = await renderPng();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't generate the image. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    setError(null);
    try {
      const blob = await renderPng();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Appointment", text: summaryText });
      } else {
        await handleDownload();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Couldn't share the image. Please try downloading instead.");
    } finally {
      setBusy(false);
    }
  }

  const patientWa = waHref(patient.phone, summaryText);
  const doctorWa = waHref(doctor.phone, summaryText);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Appointment card</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          <div
            className="mx-auto overflow-hidden rounded-2xl shadow-lg"
            style={{ width: APPT_CARD_WIDTH / 1.4, height: APPT_CARD_HEIGHT / 1.4 }}
          >
            <div
              style={{
                width: APPT_CARD_WIDTH,
                height: APPT_CARD_HEIGHT,
                transform: "scale(0.714)",
                transformOrigin: "top left",
              }}
            >
              <AppointmentCard ref={cardRef} {...card} />
            </div>
          </div>
          {error && <p className="mt-3 text-center text-xs text-rose-600">{error}</p>}
        </div>

        <div className="space-y-2 border-t border-slate-100 p-4">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleDownload} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              Download
            </Button>
            <Button type="button" className="flex-1" onClick={handleShare} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Share2 className="mr-1.5 h-4 w-4" />}
              Share
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={!patientWa}
              onClick={() => patientWa && window.open(patientWa, "_blank")}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              WhatsApp patient
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={!doctorWa}
              onClick={() => doctorWa && window.open(doctorWa, "_blank")}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              WhatsApp doctor
            </Button>
          </div>
          <p className="text-center text-[11px] text-slate-400">
            Download the card first, then attach it in the WhatsApp chat that opens.
          </p>
        </div>
      </div>
    </div>
  );
}
