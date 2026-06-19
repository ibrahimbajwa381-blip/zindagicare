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
    throw new Error("Prescription PDF must be 5 MB or smaller");
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
