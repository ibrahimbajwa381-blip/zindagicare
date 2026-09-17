import {
  createRoleDocumentStorage,
  type StoredRoleDocument,
} from "./shared/document-storage.factory";

const storage = createRoleDocumentStorage("nutritionist-verification", "nutritionist");

export type StoredNutritionistDocument = StoredRoleDocument;
export const saveNutritionistDocument = storage.save;
export const readNutritionistDocument = storage.read;
export const nutritionistDocumentStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deleteNutritionistDocument = storage.remove;
