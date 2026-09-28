import { createRoleAvatarStorage, type StoredRoleAvatar } from "./shared/avatar-storage.factory";

const storage = createRoleAvatarStorage("physiotherapist-avatars");

export type StoredPhysiotherapistAvatar = StoredRoleAvatar;
export const physiotherapistAvatarPublicUrl = storage.publicUrl;
export const isPhysiotherapistAvatarUrlForUser = storage.isUrlForUser;
export const savePhysiotherapistAvatar = storage.save;
export const readPhysiotherapistAvatar = storage.read;
export const physiotherapistAvatarStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deletePhysiotherapistAvatar = storage.remove;
