"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageIcon, Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DoctorShareCard,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  type DoctorShareCardProps,
} from "@/features/doctor/components/doctor-share-card";

type Props = {
  card: Omit<DoctorShareCardProps, "qrDataUrl">;
  triggerLabel?: string;
  className?: string;
};

export function DoctorShareCardDialog({ card, triggerLabel = "Get shareable card", className }: Props) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileName = `${card.name.replace(/\s+/g, "-").toLowerCase()}-zindagicare-card.png`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    import("qrcode").then((QRCode) =>
      QRCode.toDataURL(card.profileUrl, {
        margin: 0,
        width: 128,
        color: { dark: "#0B3D91", light: "#FFFFFF00" },
      }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [open, card.profileUrl]);

  async function renderPng(): Promise<Blob> {
    const { toBlob } = await import("html-to-image");
    if (!cardRef.current) throw new Error("Card not ready");
    const blob = await toBlob(cardRef.current, {
      width: SHARE_CARD_WIDTH,
      height: SHARE_CARD_HEIGHT,
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
        await navigator.share({
          files: [file],
          title: card.name,
          text: `Book an appointment with ${card.name} on ZindagiCare`,
        });
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

  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
        {triggerLabel}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Your shareable profile card</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
              <div
                className="mx-auto overflow-hidden rounded-2xl shadow-lg"
                style={{
                  width: SHARE_CARD_WIDTH / 2,
                  height: SHARE_CARD_HEIGHT / 2,
                }}
              >
                <div
                  style={{
                    width: SHARE_CARD_WIDTH,
                    height: SHARE_CARD_HEIGHT,
                    transform: "scale(0.5)",
                    transformOrigin: "top left",
                  }}
                >
                  <DoctorShareCard ref={cardRef} {...card} qrDataUrl={qrDataUrl} />
                </div>
              </div>

              {error && <p className="mt-3 text-center text-xs text-rose-600">{error}</p>}
            </div>

            <div className="flex gap-2 border-t border-slate-100 p-4">
              <Button type="button" variant="outline" className="flex-1" onClick={handleDownload} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                Download
              </Button>
              <Button type="button" className="flex-1" onClick={handleShare} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Share2 className="mr-1.5 h-4 w-4" />}
                Share
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
