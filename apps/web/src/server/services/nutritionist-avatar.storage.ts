import { createRoleAvatarStorage, type StoredRoleAvatar } from "./shared/avatar-storage.factory";

const storage = createRoleAvatarStorage("nutritionist-avatars");

export type StoredNutritionistAvatar = StoredRoleAvatar;
export const nutritionistAvatarPublicUrl = storage.publicUrl;
export const isNutritionistAvatarUrlForUser = storage.isUrlForUser;
export const saveNutritionistAvatar = storage.save;
export const readNutritionistAvatar = storage.read;
export const nutritionistAvatarStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deleteNutritionistAvatar = storage.remove;
