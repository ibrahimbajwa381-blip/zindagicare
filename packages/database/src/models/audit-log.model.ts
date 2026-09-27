import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * AuditLog — append-only compliance trail. No updates; TTL for old rows optional.
 */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorRole: { type: String },
    /** Snapshots of the actor's name/email at write time, so the log stays readable if the user is later renamed/deleted. */
    actorName: { type: String },
    actorEmail: { type: String },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    /** Human-readable subject snapshot (e.g. a patient/doctor name) for display without extra joins. */
    targetLabel: { type: String },
    changes: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 2 });

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema> & {
  _id: Types.ObjectId;
};

export const AuditLogModel: Model<AuditLogDocument> =
  registerModel<AuditLogDocument>("AuditLog", auditLogSchema);
