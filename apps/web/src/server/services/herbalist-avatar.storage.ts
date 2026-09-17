import { createRoleAvatarStorage, type StoredRoleAvatar } from "./shared/avatar-storage.factory";

const storage = createRoleAvatarStorage("herbalist-avatars");

export type StoredHerbalistAvatar = StoredRoleAvatar;
export const herbalistAvatarPublicUrl = storage.publicUrl;
export const isHerbalistAvatarUrlForUser = storage.isUrlForUser;
export const saveHerbalistAvatar = storage.save;
export const readHerbalistAvatar = storage.read;
export const herbalistAvatarStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deleteHerbalistAvatar = storage.remove;
