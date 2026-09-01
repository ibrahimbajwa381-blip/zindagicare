"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Plus, Star, Trash2, User } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { surfaceCard, surfaceInset } from "@/lib/ui/surfaces";

type AdminTestimonialRow = {
  id: string;
  patientId?: string;
  patientName: string;
  patientTitle?: string;
  avatarUrl?: string;
  rating?: number;
  content: string;
  isVisible: boolean;
  createdAt: string;
  source: "patient" | "admin" | "public";
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "visible", label: "Public" },
  { value: "hidden", label: "Hidden" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];
type ModerateAction = "hide" | "show" | "delete";

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            "h-3.5 w-3.5",
            index < rating ? "fill-amber-400 text-amber-400" : "text-slate-200",
          )}
        />
      ))}
    </span>
  );
}

function AddTestimonialForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [patientTitle, setPatientTitle] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [avatarPreview, setAvatarPreview] = useState<string>();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));
    setUploadingAvatar(true);
    setError(undefined);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/testimonials/avatar/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json?.error?.message ?? "Could not upload photo.");
      }
      setAvatarUrl(json.data.url);
    } catch (err) {
      setAvatarPreview(undefined);
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (patientName.trim().length < 2) {
      setError("Enter the patient's name.");
      return;
    }
    if (content.trim().length < 10) {
      setError("Testimonial text is too short.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch("/api/v1/admin/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: patientName.trim(),
          patientTitle: patientTitle.trim() || undefined,
          avatarUrl,
          rating,
          content: content.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json?.error?.message ?? "Failed to add testimonial");
      }
      setPatientName("");
      setPatientTitle("");
      setContent("");
      setRating(5);
      setAvatarUrl(undefined);
      setAvatarPreview(undefined);
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add testimonial");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add testimonial
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn(surfaceCard, "space-y-4 p-5")}>
      <div>
        <Label>Photo (optional)</Label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-brand-light hover:text-brand-light"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </button>
          <div className="text-sm text-slate-500">
            {uploadingAvatar ? (
              "Uploading…"
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-medium text-brand-dark hover:underline"
              >
                {avatarPreview ? "Change photo" : "Add a photo"}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="patientName">Patient name</Label>
        <Input
          id="patientName"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder="e.g. Seerat Hassan"
        />
      </div>

      <div>
        <Label htmlFor="patientTitle">Title / profession (optional)</Label>
        <Input
          id="patientTitle"
          value={patientTitle}
          onChange={(e) => setPatientTitle(e.target.value)}
          placeholder="e.g. Patient, Software Engineer"
        />
      </div>

      <div>
        <Label>Rating</Label>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, index) => {
            const value = index + 1;
            return (
              <button key={value} type="button" onClick={() => setRating(value)} className="p-0.5">
                <Star
                  className={cn(
                    "h-6 w-6 transition-colors",
                    value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="content">Testimonial</Label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          maxLength={3000}
          className="flex w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25"
        />
      </div>

      <FieldError message={error} />

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting || uploadingAvatar}>
          {submitting ? "Saving…" : "Publish testimonial"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminTestimonialsPanel() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [testimonials, setTestimonials] = useState<AdminTestimonialRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    if (!hasLoadedRef.current) setLoading(true);
    const qs = filter === "all" ? "" : `?visibility=${filter}`;
    fetch(`/api/v1/admin/testimonials${qs}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setError(undefined);
          setTestimonials(json.data?.testimonials ?? []);
          setTotal(json.data?.total ?? 0);
        } else {
          setError(json?.error?.message ?? "Failed to load testimonials");
        }
        hasLoadedRef.current = true;
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load testimonials");
        hasLoadedRef.current = true;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  async function moderate(row: AdminTestimonialRow, action: ModerateAction) {
    if (action === "delete") {
      const confirmed = window.confirm(
        `Permanently remove this testimonial from ${row.patientName}?`,
      );
      if (!confirmed) return;
    }

    setPendingId(row.id);
    try {
      const res = await fetch("/api/v1/admin/testimonials/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testimonialId: row.id, action }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json?.error?.message ?? "Action failed");
      }
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === item.value
                  ? "bg-brand text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-500">
            {total} testimonial{total === 1 ? "" : "s"}
          </p>
          <AddTestimonialForm onAdded={refresh} />
        </div>
      </div>

      {loading ? (
        <LoadingScreen message="Loading testimonials…" />
      ) : error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : testimonials.length === 0 ? (
        <div className={`border-dashed p-8 text-center text-sm text-slate-500 ${surfaceInset}`}>
          No testimonials in this filter yet.
        </div>
      ) : (
        <ul className="space-y-4">
          {testimonials.map((row) => (
            <li key={row.id} className={cn(surfaceCard, "p-5")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    {row.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.avatarUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {row.patientName}
                      </p>
                      {row.patientTitle ? (
                        <p className="truncate text-xs text-slate-500">{row.patientTitle}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {row.rating ? <RatingStars rating={row.rating} /> : null}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] uppercase tracking-wide",
                        row.isVisible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600",
                      )}
                    >
                      {row.isVisible ? "Public" : "Hidden"}
                    </Badge>
                    {row.source === "admin" && (
                      <Badge
                        variant="outline"
                        className="border-brand-light/60 bg-brand-muted/40 text-[10px] uppercase tracking-wide text-brand-dark"
                      >
                        Added by admin
                      </Badge>
                    )}
                    {row.source === "public" && (
                      <Badge
                        variant="outline"
                        className="border-accent-light/60 bg-accent-muted/40 text-[10px] uppercase tracking-wide text-accent-dark"
                      >
                        Shared link
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatKarachiDateTime(row.createdAt)}
                  </p>
                  <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                    {row.content}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {row.isVisible ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingId === row.id}
                      className="gap-1.5"
                      onClick={() => moderate(row, "hide")}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Hide
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingId === row.id}
                      className="gap-1.5"
                      onClick={() => moderate(row, "show")}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Show
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pendingId === row.id}
                    className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => moderate(row, "delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
