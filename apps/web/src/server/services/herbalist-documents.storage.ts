import {
  createRoleDocumentStorage,
  type StoredRoleDocument,
} from "./shared/document-storage.factory";

const storage = createRoleDocumentStorage("herbalist-verification", "herbalist");

export type StoredHerbalistDocument = StoredRoleDocument;
export const saveHerbalistDocument = storage.save;
export const readHerbalistDocument = storage.read;
export const herbalistDocumentStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deleteHerbalistDocument = storage.remove;
