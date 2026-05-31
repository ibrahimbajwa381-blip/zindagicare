import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), ".uploads", "home-visit-reports");
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type StoredVisitReport = {
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
};

export async function saveHomeVisitReport(
  visitId: string,
  file: File,
): Promise<StoredVisitReport> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, WebP, or PDF files are allowed");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File must be 5 MB or smaller");
  }

  const ext = path.extname(file.name) || mimeToExt(file.type);
  const storageKey = `${visitId}/${randomUUID()}${ext}`;
  const absolutePath = path.join(UPLOAD_ROOT, storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    storageKey,
    url: `/api/v1/home-visits/reports/${encodeURIComponent(storageKey)}`,
    originalName: file.name,
    mimeType: file.type,
  };
}

export function resolveHomeVisitReportPath(storageKey: string): string {
  const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.join(UPLOAD_ROOT, normalized);
  if (!absolutePath.startsWith(UPLOAD_ROOT)) {
    throw new Error("Invalid report path");
  }
  return absolutePath;
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}
