"use client";

import { useCallback, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { Label } from "@/components/ui/input";
import { useIsMountedRef } from "@/hooks/use-is-mounted-ref";

type VerificationDocumentUploadProps = {
  label: string;
  docKey: string;
  value?: string;
  fileName?: string;
  uploadUrl: string;
  onUploaded: (url: string, fileName: string) => void;
  onClear?: () => void;
  accept?: string;
  hint?: string;
};

export function VerificationDocumentUpload({
  label,
  docKey,
  value,
  fileName,
  uploadUrl,
  onUploaded,
  onClear,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  hint = "JPG, PNG, WebP, or PDF · max 5 MB",
}: VerificationDocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useIsMountedRef();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [dragOver, setDragOver] = useState(false);
  const [localName, setLocalName] = useState<string>();

  const displayName = fileName ?? localName;
  const isPdf = displayName?.toLowerCase().endsWith(".pdf");
  const uploaded = Boolean(value);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!mountedRef.current) return;

      setUploading(true);
      setUploadError(undefined);
      setLocalName(file.name);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(uploadUrl, { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? "Upload failed");
        }
        const data = await res.json();
        if (mountedRef.current) {
          onUploaded(data.data.url, file.name);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        setLocalName(undefined);
      } finally {
        if (mountedRef.current) {
          setUploading(false);
        }
      }
    },
    [mountedRef, onUploaded, uploadUrl],
  );

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void uploadFile(file);
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLocalName(undefined);
    setUploadError(undefined);
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  }

  return (
    <div>
      <Label htmlFor={docKey}>{label}</Label>
      <label
        htmlFor={docKey}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "mt-1.5 block cursor-pointer rounded-xl border-2 border-dashed p-4 transition",
          dragOver && "border-brand bg-brand-muted/40",
          uploaded && !uploadError
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-slate-200 bg-slate-50/80 hover:border-brand/40 hover:bg-white",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <input
          ref={inputRef}
          id={docKey}
          type="file"
          accept={accept}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
          className="sr-only"
        />

        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              uploaded ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500 shadow-sm",
            )}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : uploaded ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isPdf ? (
              <FileText className="h-5 w-5" />
            ) : displayName ? (
              <ImageIcon className="h-5 w-5" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {uploading ? (
              <p className="text-sm font-medium text-slate-700">Uploading…</p>
            ) : uploaded ? (
              <>
                <p className="text-sm font-medium text-emerald-800">Document uploaded</p>
                {displayName && (
                  <p className="mt-0.5 truncate text-xs text-emerald-700/80">{displayName}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-800">
                  Tap to choose or drag a file here
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
              </>
            )}
          </div>

          {(uploaded || displayName) && !uploading && onClear && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </label>
      {uploadError && <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}
