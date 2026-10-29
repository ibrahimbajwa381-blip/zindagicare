import {
  normalizeEmailForLookup,
  normalizePhoneForLookup,
  roleSetViolation,
  Roles,
  type Role,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { applyFieldEncryption } from "../lib/field-encryption-plugin";
import { registerModel } from "../lib/register-model";

/**
 * User — identity & auth hub only (multi-role).
 * Role-specific clinical/commerce data lives in DoctorProfile, PatientProfile, StaffProfile.
 * PII fields (name, email, phone) are AES-256-GCM encrypted at rest.
 * emailLookup / phoneLookup store HMAC hashes for login queries without plaintext.
 */
const userSchema = new Schema(
  {
    email: { type: String },
    phone: { type: String },
    /** HMAC-SHA256 of normalized email — used for login / uniqueness checks */
    emailLookup: { type: String, select: false },
    /** HMAC-SHA256 of normalized phone — used for login / uniqueness checks */
    phoneLookup: { type: String, select: false },
    passwordHash: { type: String, select: false },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    /**
     * Patient XOR exactly one clinical staff role (doctor, nurse, physiotherapist,
     * herbalist, nutritionist) per account — enforced by roleSetViolation.
     * Rider/admin/lab/other are unaffected by this invariant.
     */
    roles: {
      type: [String],
      enum: Object.values(Roles),
      default: [Roles.PATIENT],
      validate: {
        // Checked when roles are set or changed, so legacy accounts awaiting
        // scripts/normalize-account-roles.ts can still save unrelated fields.
        validator(this: { isNew?: boolean; isModified?: (path: string) => boolean }, roles: Role[]) {
          if (typeof this.isModified === "function" && !this.isNew && !this.isModified("roles")) {
            return true;
          }
          return roleSetViolation(roles) === null;
        },
        message: (props: { value: Role[] }) =>
          roleSetViolation(props.value) ?? "Invalid roles",
      },
    },
    authProviders: {
      type: [String],
      enum: ["credentials", "google", "phone"],
      default: ["credentials"],
    },
    emailVerified: { type: Date },
    phoneVerified: { type: Date },
    dateOfBirth: { type: Date },
    /** Google account id (sub) — set when a Google login is linked to this user. */
    googleId: { type: String, select: false },
    onboardingCompleted: { type: Boolean, default: false },
    /** Points to family account head for dependents without their own login */
    familyHeadId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    noShowCount: { type: Number, default: 0 },
    bannedUntil: { type: Date },
    /** Blocks Sunday free consult only (general ban uses bannedUntil) */
    sundayBannedUntil: { type: Date },
    earlyAccessSunday: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date },
    metadata: {
      locale: { type: String, enum: ["en", "ur"], default: "en" },
      city: { type: String, default: "Lahore", index: true },
    },
  },
  { timestamps: true },
);

applyFieldEncryption(userSchema, {
  fields: [{ path: "name", kind: "string" }],
  lookups: [
    {
      field: "email",
      lookupField: "emailLookup",
      normalize: normalizeEmailForLookup,
    },
    {
      field: "phone",
      lookupField: "phoneLookup",
      normalize: normalizePhoneForLookup,
    },
  ],
});

userSchema.index({ emailLookup: 1 }, { unique: true, sparse: true });
userSchema.index({ phoneLookup: 1 }, { unique: true, sparse: true });
userSchema.index({ roles: 1, isActive: 1 });
userSchema.index({ bannedUntil: 1 }, { sparse: true });

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
  roles: Role[];
};

export const UserModel: Model<UserDocument> = registerModel<UserDocument>(
  "User",
  userSchema,
);
