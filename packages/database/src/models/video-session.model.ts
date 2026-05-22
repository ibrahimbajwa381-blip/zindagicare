import {
  VideoSessionStatuses,
  type VideoSessionStatus,
} from "@zindagi/shared";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "../lib/register-model";

/**
 * VideoSession — Agora/Twilio channel metadata (tokens generated at runtime, not stored long-term).
 */
const videoSessionSchema = new Schema(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    channelName: { type: String, required: true, index: true },
    provider: { type: String, enum: ["agora", "twilio"], default: "agora" },
    status: {
      type: String,
      enum: Object.values(VideoSessionStatuses),
      default: VideoSessionStatuses.WAITING,
      index: true,
    },
    patientJoinedAt: { type: Date },
    doctorJoinedAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationSeconds: { type: Number },
    recordingEnabled: { type: Boolean, default: false },
    recordingUrl: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

videoSessionSchema.index({ status: 1, createdAt: -1 });

export type VideoSessionDocument = InferSchemaType<
  typeof videoSessionSchema
> & {
  _id: Schema.Types.ObjectId;
  status: VideoSessionStatus;
};

export const VideoSessionModel: Model<VideoSessionDocument> =
  registerModel<VideoSessionDocument>("VideoSession", videoSessionSchema);
