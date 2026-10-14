"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ImagePlus, Lock, ShieldAlert, X } from "lucide-react";
import { cn } from "@zindagi/shared";
import { MEDICAL_QA_LIMITS, MedicalQaCategories, type MedicalQaCategory } from "@zindagi/validators";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useTranslations } from "@/i18n/locale-provider";
import { surfaceCard } from "@/lib/ui/surfaces";
import { ACCEPTED_PHOTO_TYPES, createQuestion, prepareImageForUpload, uploadPhoto } from "../lib/qa-api";
import { EmergencyNotice } from "./emergency-notice";

const MAX_PICK_BYTES = 10 * 1024 * 1024;
const ASK_PATH = "/questions/ask";

type PickedPhoto = { file: File; preview: string };

const textareaClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-foreground shadow-sm placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:rounded-lg sm:px-3 sm:text-sm";

export function AskQuestionForm({ initialCategory }: { initialCategory?: MedicalQaCategory }) {
  const t = useTranslations().medicalQa;
  const f = t.form;
  const router = useRouter();
  const { status } = useSession();

  const [category, setCategory] = useState<MedicalQaCategory>(initialCategory ?? "general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [phase, setPhase] = useState<"idle" | "posting" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // One key per form fill: a double tap or retry after a dropped response can't create duplicates.
  const idempotencyKey = useRef<string>("");

  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
  }, []);

  // Revoke whatever previews are still shown when the form unmounts (removals revoke their own).
  const photosRef = useRef<PickedPhoto[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  if (status === "unauthenticated") {
    return (
      <div className={cn(surfaceCard, "p-6 text-center sm:p-8")}>
        <h2 className="text-lg font-semibold text-slate-900">{f.loginTitle}</h2>
        <p className="mt-2 text-sm text-slate-600">{f.loginDescription}</p>
        <Button asChild size="lg" className="mt-5">
          <Link href={`/login?callbackUrl=${encodeURIComponent(ASK_PATH)}`}>{f.loginButton}</Link>
        </Button>
      </div>
    );
  }

  const titleLen = title.trim().length;
  const bodyLen = body.trim().length;
  const canSubmit =
    status === "authenticated" &&
    phase === "idle" &&
    titleLen >= MEDICAL_QA_LIMITS.titleMin &&
    bodyLen >= MEDICAL_QA_LIMITS.bodyMin;

  function onPickPhotos(list: FileList | null) {
    if (!list) return;
    setError(null);
    const room = MEDICAL_QA_LIMITS.maxAttachments - photos.length;
    const picked: PickedPhoto[] = [];
    for (const file of Array.from(list).slice(0, room)) {
      if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
        setError(f.photoUnsupported);
        continue;
      }
      if (file.size > MAX_PICK_BYTES) {
        setError(f.photoTooLarge);
        continue;
      }
      picked.push({ file, preview: URL.createObjectURL(file) });
    }
    setPhotos((prev) => [...prev, ...picked]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPhase("posting");
    try {
      const question = await createQuestion({ category, title, body, idempotencyKey: idempotencyKey.current });

      let failed = 0;
      if (photos.length > 0) {
        setPhase("uploading");
        for (const photo of photos) {
          try {
            await uploadPhoto(question.id, await prepareImageForUpload(photo.file));
          } catch {
            failed += 1;
          }
        }
      }
      router.push(`/questions/${question.id}${failed > 0 ? "?photos=failed" : ""}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : f.errorGeneric);
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn(surfaceCard, "space-y-5 p-5 sm:p-7")} noValidate>
      <EmergencyNotice />

      <div>
        <Label htmlFor="qa-category">{f.categoryLabel}</Label>
        <select
          id="qa-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as MedicalQaCategory)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:text-sm"
        >
          {MedicalQaCategories.map((c) => (
            <option key={c} value={c}>
              {t.categories[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="qa-title">{f.titleLabel}</Label>
        <Input
          id="qa-title"
          dir="auto"
          value={title}
          maxLength={MEDICAL_QA_LIMITS.titleMax}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={f.titlePlaceholder}
          autoComplete="off"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          {titleLen > 0 && titleLen < MEDICAL_QA_LIMITS.titleMin
            ? f.minLength.replace("{count}", String(MEDICAL_QA_LIMITS.titleMin))
            : f.charactersLeft.replace("{count}", String(MEDICAL_QA_LIMITS.titleMax - title.length))}
        </p>
      </div>

      <div>
        <Label htmlFor="qa-body">{f.bodyLabel}</Label>
        <textarea
          id="qa-body"
          dir="auto"
          rows={6}
          value={body}
          maxLength={MEDICAL_QA_LIMITS.bodyMax}
          onChange={(e) => setBody(e.target.value)}
          placeholder={f.bodyPlaceholder}
          className={textareaClass}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          {bodyLen > 0 && bodyLen < MEDICAL_QA_LIMITS.bodyMin
            ? f.minLength.replace("{count}", String(MEDICAL_QA_LIMITS.bodyMin))
            : f.charactersLeft.replace("{count}", String(MEDICAL_QA_LIMITS.bodyMax - body.length))}
        </p>
      </div>

      <div>
        <Label>{f.photosLabel}</Label>
        <p className="mb-2 flex gap-1.5 text-xs text-slate-600">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
          {f.photosHint.replace("{count}", String(MEDICAL_QA_LIMITS.maxAttachments))}
        </p>
        <div className="flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview */}
              <img src={p.preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label={f.removePhoto}
                className="absolute end-1 top-1 rounded-full bg-black/60 p-1 text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {photos.length < MEDICAL_QA_LIMITS.maxAttachments ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs font-medium text-slate-600 hover:border-brand-light hover:text-brand-dark"
            >
              <ImagePlus className="h-5 w-5" aria-hidden />
              {f.addPhoto}
            </button>
          ) : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => onPickPhotos(e.target.files)}
        />
      </div>

      <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
        {f.publicNotice}
      </p>

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!canSubmit} loading={phase !== "idle"}>
        {phase === "posting" ? f.submitting : phase === "uploading" ? f.uploadingPhotos : f.submit}
      </Button>
    </form>
  );
}
