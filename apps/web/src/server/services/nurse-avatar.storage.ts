import { createRoleAvatarStorage, type StoredRoleAvatar } from "./shared/avatar-storage.factory";

const storage = createRoleAvatarStorage("nurse-avatars");

export type StoredNurseAvatar = StoredRoleAvatar;
export const nurseAvatarPublicUrl = storage.publicUrl;
export const isNurseAvatarUrlForUser = storage.isUrlForUser;
export const saveNurseAvatar = storage.save;
export const readNurseAvatar = storage.read;
export const nurseAvatarStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deleteNurseAvatar = storage.remove;
