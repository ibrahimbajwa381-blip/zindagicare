import {
  createRoleDocumentStorage,
  type StoredRoleDocument,
} from "./shared/document-storage.factory";

const storage = createRoleDocumentStorage("physiotherapist-verification", "physiotherapist");

export type StoredPhysiotherapistDocument = StoredRoleDocument;
export const savePhysiotherapistDocument = storage.save;
export const readPhysiotherapistDocument = storage.read;
export const physiotherapistDocumentStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deletePhysiotherapistDocument = storage.remove;
export const canAccessPhysiotherapistDocument = storage.canAccess;
