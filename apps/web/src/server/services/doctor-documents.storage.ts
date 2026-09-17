import {
  createRoleDocumentStorage,
  type StoredRoleDocument,
} from "./shared/document-storage.factory";

const storage = createRoleDocumentStorage("doctor-verification", "doctor");

export type StoredDocument = StoredRoleDocument;
export const saveDoctorDocument = storage.save;
export const readDoctorDocument = storage.read;
export const doctorDocumentStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deleteDoctorDocument = storage.remove;
