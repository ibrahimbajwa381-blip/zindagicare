import type { MedicalQaCategory } from "@zindagi/validators";
import type {
  MedicalAnswerDto,
  MedicalQuestionDetailDto,
  MedicalQuestionPhotoDto,
  MedicalQuestionSummaryDto,
} from "../types";

type ApiResult<T> = { success: boolean; data: T | null; error?: { message: string; code?: string } | null };

export class QaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  let json: ApiResult<T> | null = null;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch {
    // Non-JSON error bodies (e.g. a proxy 413) fall through to the generic error.
  }
  if (!res.ok || !json?.success || json.data === null) {
    throw new QaApiError(json?.error?.message ?? "Request failed", res.status, json?.error?.code ?? undefined);
  }
  return json.data;
}

const base = "/api/v1/medical-questions";

function postJson(url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchQuestions(params: {
  cursor?: string | null;
  category?: MedicalQaCategory | null;
  filter?: "all" | "unanswered" | "mine";
  q?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{ items: MedicalQuestionSummaryDto[]; nextCursor: string | null; total: number | null }> {
  const search = new URLSearchParams();
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.category) search.set("category", params.category);
  if (params.filter && params.filter !== "all") search.set("filter", params.filter);
  if (params.q) search.set("q", params.q);
  if (params.limit) search.set("limit", String(params.limit));
  return parse(await fetch(`${base}?${search.toString()}`, { signal: params.signal }));
}

export async function fetchQuestion(id: string, signal?: AbortSignal): Promise<MedicalQuestionDetailDto> {
  return parse(await fetch(`${base}/${encodeURIComponent(id)}`, { cache: "no-store", signal }));
}

export async function createQuestion(input: {
  category: MedicalQaCategory;
  title: string;
  body: string;
  idempotencyKey: string;
}): Promise<MedicalQuestionSummaryDto> {
  return parse(await postJson(base, input));
}

export async function postAnswer(questionId: string, body: string, idempotencyKey: string): Promise<MedicalAnswerDto> {
  return parse(await postJson(`${base}/${encodeURIComponent(questionId)}/answers`, { body, idempotencyKey }));
}

export async function reportContent(
  questionId: string,
  input: { targetType: "question" | "answer"; targetId: string; reason: string },
): Promise<{ reported: boolean }> {
  return parse(await postJson(`${base}/${encodeURIComponent(questionId)}/reports`, input));
}

export async function deleteQuestion(questionId: string): Promise<{ deleted: boolean }> {
  return parse(await fetch(`${base}/${encodeURIComponent(questionId)}`, { method: "DELETE" }));
}

export async function uploadPhoto(questionId: string, file: Blob): Promise<MedicalQuestionPhotoDto> {
  const form = new FormData();
  form.set("file", file, "photo");
  return parse(
    await fetch(`${base}/${encodeURIComponent(questionId)}/attachments`, { method: "POST", body: form }),
  );
}

export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const SHRINK_MAX_EDGE = 2400;

/**
 * Convenience only — the server re-validates and re-encodes everything.
 * Large phone photos are scaled down in the browser before upload so they
 * fit the hosting request limit and upload quickly on mobile data, while
 * staying well above the server's readability floor. Falls back to the
 * original file if the browser can't decode it.
 */
export async function prepareImageForUpload(file: File): Promise<Blob> {
  if (file.size <= SHRINK_ABOVE_BYTES || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, SHRINK_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
