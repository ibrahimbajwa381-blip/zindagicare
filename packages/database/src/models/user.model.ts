import { Roles, type Role } from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * User — identity & auth hub only (multi-role).
 * Role-specific clinical/commerce data lives in DoctorProfile, PatientProfile, StaffProfile.
 * Query: login by email/phone; middleware loads roles from JWT (denormalized at sign-in).
 */
const userSchema = new Schema(
  {
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    roles: {
      type: [String],
      enum: Object.values(Roles),
      default: [Roles.PATIENT],
    },
    authProviders: {
      type: [String],
      enum: ["credentials", "google", "phone"],
      default: ["credentials"],
    },
    emailVerified: { type: Date },
    phoneVerified: { type: Date },
    onboardingCompleted: { type: Boolean, default: false },
    /** Points to family account head for dependents without their own login */
    familyHeadId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    noShowCount: { type: Number, default: 0 },
    bannedUntil: { type: Date },
    /** Blocks Sunday free consult only (general ban uses bannedUntil) */
    sundayBannedUntil: { type: Date },
    earlyAccessSunday: { type: Boolean, default: false },
    fcmTokens: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date },
    metadata: {
      locale: { type: String, enum: ["en", "ur"], default: "en" },
      city: { type: String, default: "Lahore", index: true },
    },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ roles: 1, isActive: 1 });
userSchema.index({ bannedUntil: 1 }, { sparse: true });

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: Schema.Types.ObjectId;
  roles: Role[];
};

export const UserModel: Model<UserDocument> = registerModel<UserDocument>(
  "User",
  userSchema,
);
