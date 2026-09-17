import {
  createRoleDocumentStorage,
  type StoredRoleDocument,
} from "./shared/document-storage.factory";

const storage = createRoleDocumentStorage("nurse-verification", "nurse");

export type StoredNurseDocument = StoredRoleDocument;
export const saveNurseDocument = storage.save;
export const readNurseDocument = storage.read;
export const nurseDocumentStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deleteNurseDocument = storage.remove;
export const canAccessNurseDocument = storage.canAccess;
