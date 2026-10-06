"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/input";
import { NurseAvatar } from "@/features/nurse/components/nurse-avatar";
import { preparePhotoUpload } from "@/lib/ui/prepare-photo-upload";

type NurseProfilePhotoUploadProps = {
  name: string;
  value?: string;
  onUploaded: (url: string) => void;
  required?: boolean;
  className?: string;
  uploadEndpoint?: string;
};

export function NurseProfilePhotoUpload({
  name,
  value,
  onUploaded,
  required = false,
  className,
  uploadEndpoint = "/api/v1/nurse/avatar/upload",
}: NurseProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(undefined);

    try {
      const formData = new FormData();
      formData.append("file", await preparePhotoUpload(file));

      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.data?.url) {
        setUploadError(data?.error?.message ?? "Upload failed");
        return;
      }
      onUploaded(data.data.url);
    } catch {
      setUploadError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      // Allow re-selecting the same file after an error or a change of mind.
      input.value = "";
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Label htmlFor="nurse-profile-photo">
        Profile photo{required ? " *" : ""}
      </Label>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <NurseAvatar name={name} avatarUrl={value} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="nurse-profile-photo"
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              <Camera className="h-4 w-4" />
              {uploading ? "Uploading…" : value ? "Change photo" : "Upload photo"}
            </label>
            <input
              id="nurse-profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              disabled={uploading}
              className="sr-only"
            />
            {value && !uploading && (
              <Badge variant="secondary" className="text-xs">
                Photo added
              </Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Use a clear, front-facing headshot with good lighting. JPG, PNG, or
            WebP — we optimize it automatically. This appears on your public
            nurse profile after approval.
          </p>
          {uploadError && (
            <p className="mt-2 text-xs text-red-600">{uploadError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
