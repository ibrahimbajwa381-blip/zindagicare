import { createRoleAvatarStorage, type StoredRoleAvatar } from "./shared/avatar-storage.factory";

const storage = createRoleAvatarStorage("doctor-avatars");

export type StoredDoctorAvatar = StoredRoleAvatar;
export const doctorAvatarPublicUrl = storage.publicUrl;
export const isDoctorAvatarUrlForUser = storage.isUrlForUser;
export const saveDoctorAvatar = storage.save;
export const readDoctorAvatar = storage.read;
export const doctorAvatarStorageKeyFromUrl = storage.storageKeyFromUrl;
export const deleteDoctorAvatar = storage.remove;
