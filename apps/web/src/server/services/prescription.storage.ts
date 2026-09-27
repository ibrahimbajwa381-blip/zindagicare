import { AppError } from "@zindagi/shared";
import { randomUUID } from "crypto";
import { wrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import {
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";

const NAMESPACE: StorageNamespace = "prescriptions";
const MAX_BYTES = 5 * 1024 * 1024;

export type StoredPrescriptionFile = {
  storageKey: string;
  url: string;
  mimeType: string;
  fileSizeBytes: number;
};

export async function savePrescriptionPdf(
  appointmentId: string,
  pdfBuffer: Buffer,
): Promise<StoredPrescriptionFile> {
  if (pdfBuffer.length > MAX_BYTES) {
    throw new AppError("Prescription PDF must be 5 MB or smaller", "VALIDATION_ERROR", 400);
  }

  const storageKey = `${appointmentId}/${randomUUID()}.pdf`;
  const encrypted = wrapEncryptedFile(pdfBuffer);
  await putObject(NAMESPACE, storageKey, encrypted, "application/pdf");

  return {
    storageKey,
    url: `/api/v1/prescriptions/files/${encodeURIComponent(storageKey)}`,
    mimeType: "application/pdf",
    fileSizeBytes: pdfBuffer.length,
  };
}

export async function readPrescriptionPdf(storageKey: string): Promise<Buffer> {
  return getObject(NAMESPACE, storageKey);
}

export function prescriptionDownloadUrl(storageKey: string): string {
  return `/api/v1/prescriptions/files/${encodeURIComponent(storageKey)}`;
}

export function prescriptionDownloadFilename(patientName: string): string {
  const safeName =
    patientName
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .trim()
      .replace(/\s+/g, " ") || "Patient";
  return `${safeName} ZindagiCare.pdf`;
}

export function prescriptionContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encoded = encodeURIComponent(filename);
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
