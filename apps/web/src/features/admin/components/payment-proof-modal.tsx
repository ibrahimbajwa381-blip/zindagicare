"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Eye, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentProofModalProps = {
  paymentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
};

export function PaymentProofModal({
  paymentId,
  isOpen,
  onClose,
  title = "Payment Proof",
}: PaymentProofModalProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Reset state when modal opens or paymentId changes
  useEffect(() => {
    if (isOpen && paymentId) {
      setLoading(true);
      setFailed(false);
      setZoom(1);
    }
  }, [isOpen, paymentId]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !paymentId) {
    return null;
  }

  const receiptUrl = `/api/v1/payments/${paymentId}/receipt`;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="font-mono text-xs text-slate-500">ID: {paymentId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!failed && (
              <>
                <div className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-600 hover:text-slate-900"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.5}
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center text-xs font-medium text-slate-600">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-600 hover:text-slate-900"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-600 hover:text-slate-900"
                    onClick={handleZoomReset}
                    disabled={zoom === 1}
                    title="Reset zoom"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Open original</span>
                </a>

                <a
                  href={receiptUrl}
                  download={`payment-receipt-${paymentId}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white hover:bg-brand-dark"
                  title="Download image"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
              </>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={onClose}
              title="Close (ESC)"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="relative flex flex-1 items-center justify-center overflow-auto bg-slate-950/90 p-6 min-h-[350px] max-h-[calc(90vh-80px)]">
          {loading && !failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 text-white z-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
              <p className="text-sm font-medium text-slate-300">Loading payment proof from secure storage…</p>
            </div>
          )}

          {failed ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-slate-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-amber-400">
                <Eye className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Payment proof image unavailable</p>
                <p className="mt-1 max-w-md text-xs text-slate-400">
                  The payment receipt image could not be loaded. The patient may have provided a manual transaction ID reference instead of an image attachment.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                onClick={onClose}
              >
                Close viewer
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center transition-transform duration-150 ease-out" style={{ transform: `scale(${zoom})` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptUrl}
                alt={`Payment proof for ${paymentId}`}
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
