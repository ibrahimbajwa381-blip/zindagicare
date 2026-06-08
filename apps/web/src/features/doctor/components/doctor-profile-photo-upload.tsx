"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/input";
import { DoctorAvatar } from "@/features/doctor/components/doctor-avatar";

type DoctorProfilePhotoUploadProps = {
  name: string;
  value?: string;
  onUploaded: (url: string) => void;
  required?: boolean;
  className?: string;
};

export function DoctorProfilePhotoUpload({
  name,
  value,
  onUploaded,
  required = false,
  className,
}: DoctorProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(undefined);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/v1/doctor/avatar/upload", {
      method: "POST",
      body: formData,
    });

    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setUploadError(data?.error?.message ?? "Upload failed");
      return;
    }

    const data = await res.json();
    onUploaded(data.data.url);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Label htmlFor="doctor-profile-photo">
        Profile photo{required ? " *" : ""}
      </Label>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <DoctorAvatar name={name} avatarUrl={value} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="doctor-profile-photo"
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              <Camera className="h-4 w-4" />
              {uploading ? "Uploading…" : value ? "Change photo" : "Upload photo"}
            </label>
            <input
              id="doctor-profile-photo"
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
            Use a clear headshot. JPG, PNG, or WebP up to 3 MB. This appears on your
            public doctor profile after approval.
          </p>
          {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
        </div>
      </div>
    </div>
  );
}
