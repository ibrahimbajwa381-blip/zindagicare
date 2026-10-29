import { randomUUID } from "crypto";
import {
  connectDatabase,
  DoctorProfileModel,
  UserModel,
  VideoSessionModel,
} from "@zindagi/database";
import { AppError, ErrorCodes, VideoSessionStatuses, withDoctorTitle } from "@zindagi/shared";
import { videoConsultPath } from "@/features/consult/paths";
import { mongoFilter } from "@/lib/mongo/query";
import { publishCallRingEvent } from "@/lib/realtime/call-ring-emitter";
import { sendExpoPushToUser, sendWebPushToUser } from "@/server/services/push.service";
import {
  getJoinWindow,
  VideoSessionService,
  type VideoParticipantRole,
} from "@/server/services/video-session.service";

/** How long one ring keeps ringing before it counts as missed (WhatsApp rings ~45s). */
export const CALL_RING_TIMEOUT_MS = 45_000;
/** Re-ring pushes closer together than this are skipped, so a fast client can't spam the callee. */
const RE_RING_MIN_INTERVAL_MS = 5_000;

export type CallRingStatus = "ringing" | "answered" | "declined" | "cancelled" | "missed";

/** Stored on VideoSession.metadata.ring — one ring per consult at a time. */
type StoredRing = {
  id: string;
  fromUserId: string;
  fromRole: VideoParticipantRole;
  toUserId: string;
  startedAt: Date;
  lastAt: Date;
  answeredAt?: Date;
  declinedAt?: Date;
  cancelledAt?: Date;
};

export type CallRingResult = { ringId: string; status: CallRingStatus };

export type IncomingCallRing = {
  ringId: string;
  appointmentId: string;
  fromName: string;
  fromRole: VideoParticipantRole;
  fromAvatarUrl: string | null;
  startedAt: string;
};

function ringStatus(ring: StoredRing, now = Date.now()): CallRingStatus {
  if (ring.answeredAt) return "answered";
  if (ring.declinedAt) return "declined";
  if (ring.cancelledAt) return "cancelled";
  if (now - new Date(ring.startedAt).getTime() > CALL_RING_TIMEOUT_MS) return "missed";
  return "ringing";
}

function readRing(metadata: unknown): StoredRing | null {
  const ring = (metadata as { ring?: StoredRing } | null | undefined)?.ring;
  return ring?.id ? ring : null;
}

async function loadCallContext(userId: string, appointmentId: string) {
  const { appointment, role } = await VideoSessionService.resolveParticipant(userId, appointmentId);

  let counterpartUserId: string | null;
  if (role === "doctor") {
    counterpartUserId = appointment.patientId.toString();
  } else {
    const doctor = await DoctorProfileModel.findById(appointment.doctorId).select("userId").lean();
    counterpartUserId = doctor?.userId?.toString() ?? null;
  }
  if (!counterpartUserId) {
    throw new AppError("The other participant could not be found.", ErrorCodes.NOT_FOUND, 404);
  }

  const session = await VideoSessionModel.findOne(
    mongoFilter({ appointmentId: appointment._id.toString() }),
  )
    .select("status metadata")
    .lean();

  return { appointment, role, counterpartUserId, session };
}

async function sendRingPushes(params: {
  ring: StoredRing;
  appointmentId: string;
  includeMobile: boolean;
}) {
  const { ring, appointmentId } = params;
  const caller = await UserModel.findById(ring.fromUserId).select("name").lean();
  const callerName =
    ring.fromRole === "doctor"
      ? withDoctorTitle(caller?.name ?? "Your doctor")
      : (caller?.name ?? "Your patient");
  const title = `${callerName} is calling`;
  const body = "Tap to join your ZindagiCare video consultation.";
  const url = videoConsultPath(appointmentId);

  await Promise.all([
    sendWebPushToUser(ring.toUserId, {
      title,
      body,
      url,
      tag: `call-${appointmentId}`,
      kind: "call",
      appointmentId,
      ringId: ring.id,
    }).catch((err) => console.error("[call-ring] web push failed", err)),
    params.includeMobile
      ? sendExpoPushToUser(ring.toUserId, {
          title,
          body,
          data: { type: "video_call_ring", appointmentId, url },
        }).catch((err) => console.error("[call-ring] expo push failed", err))
      : null,
  ]);
}

async function updateRing(appointmentId: string, ringId: string, set: Record<string, unknown>) {
  const result = await VideoSessionModel.updateOne(
    mongoFilter({ appointmentId, "metadata.ring.id": ringId }),
    { $set: set },
  );
  return result.matchedCount > 0;
}

export class VideoRingService {
  /**
   * Rings the other participant of a live video consult. Without `ringId` it
   * starts a new ring; with one it re-rings (another push, so the callee's
   * phone keeps buzzing) until the ring is answered, declined, cancelled or
   * times out — the returned status tells the caller when to stop.
   */
  static async ring(userId: string, appointmentId: string, ringId?: string): Promise<CallRingResult> {
    await connectDatabase();
    const { appointment, role, counterpartUserId, session } = await loadCallContext(
      userId,
      appointmentId,
    );

    if (!getJoinWindow(appointment).canJoin) {
      throw new AppError("The video room is not open right now.", ErrorCodes.VALIDATION, 400);
    }
    const meetingId = (session?.metadata as { meetingId?: number } | undefined)?.meetingId;
    if (!session || !meetingId || session.status === VideoSessionStatuses.COMPLETED) {
      throw new AppError("Join the video call first, then ring.", ErrorCodes.VALIDATION, 400);
    }

    const id = appointment._id.toString();
    const existing = readRing(session.metadata);
    const now = new Date();

    if (ringId) {
      if (!existing || existing.id !== ringId || existing.fromUserId !== userId) {
        return { ringId, status: "cancelled" };
      }
      const status = ringStatus(existing, now.getTime());
      if (status !== "ringing") return { ringId, status };

      if (now.getTime() - new Date(existing.lastAt).getTime() >= RE_RING_MIN_INTERVAL_MS) {
        await updateRing(id, ringId, { "metadata.ring.lastAt": now });
        await sendRingPushes({ ring: existing, appointmentId: id, includeMobile: false });
      }
      return { ringId, status };
    }

    // A double-tap (or two tabs) joins the ring already in progress instead of starting another.
    if (
      existing &&
      existing.fromUserId === userId &&
      ringStatus(existing, now.getTime()) === "ringing" &&
      now.getTime() - new Date(existing.startedAt).getTime() < RE_RING_MIN_INTERVAL_MS
    ) {
      return { ringId: existing.id, status: "ringing" };
    }

    const ring: StoredRing = {
      id: randomUUID(),
      fromUserId: userId,
      fromRole: role,
      toUserId: counterpartUserId,
      startedAt: now,
      lastAt: now,
    };
    await VideoSessionModel.updateOne(mongoFilter({ _id: session._id }), {
      $set: { "metadata.ring": ring },
    });

    publishCallRingEvent([counterpartUserId], { type: "ring_updated", appointmentId: id });
    await sendRingPushes({ ring, appointmentId: id, includeMobile: true });

    return { ringId: ring.id, status: "ringing" };
  }

  /** The caller hangs up before the other side answers. */
  static async cancel(userId: string, appointmentId: string, ringId: string) {
    return VideoRingService.finish(userId, appointmentId, ringId, "caller", "cancelledAt");
  }

  /** The callee rejects the ring. */
  static async decline(userId: string, appointmentId: string, ringId: string) {
    return VideoRingService.finish(userId, appointmentId, ringId, "callee", "declinedAt");
  }

  /** The callee opened the call — called when they join, whether or not a ring is active. */
  static async answer(userId: string, appointmentId: string) {
    await connectDatabase();
    const { session } = await loadCallContext(userId, appointmentId);
    const ring = readRing(session?.metadata);
    if (!ring || ring.toUserId !== userId || ringStatus(ring) !== "ringing") {
      return { ok: true };
    }
    return VideoRingService.finish(userId, appointmentId, ring.id, "callee", "answeredAt");
  }

  private static async finish(
    userId: string,
    appointmentId: string,
    ringId: string,
    side: "caller" | "callee",
    field: "cancelledAt" | "declinedAt" | "answeredAt",
  ) {
    await connectDatabase();
    const { appointment, session } = await loadCallContext(userId, appointmentId);
    const ring = readRing(session?.metadata);
    if (!ring || ring.id !== ringId) return { ok: true };

    const allowedUserId = side === "caller" ? ring.fromUserId : ring.toUserId;
    if (allowedUserId !== userId) {
      throw new AppError("Forbidden", ErrorCodes.FORBIDDEN, 403);
    }
    if (ringStatus(ring) !== "ringing") return { ok: true };

    const id = appointment._id.toString();
    await updateRing(id, ringId, { [`metadata.ring.${field}`]: new Date() });
    publishCallRingEvent([ring.fromUserId, ring.toUserId], { type: "ring_updated", appointmentId: id });
    return { ok: true };
  }

  /** The newest ring currently ringing for this user, if any. */
  static async getIncoming(userId: string): Promise<IncomingCallRing | null> {
    await connectDatabase();
    const since = new Date(Date.now() - CALL_RING_TIMEOUT_MS);
    const sessions = await VideoSessionModel.find(
      mongoFilter({
        "metadata.ring.toUserId": userId,
        "metadata.ring.startedAt": { $gt: since },
        status: { $nin: [VideoSessionStatuses.COMPLETED, VideoSessionStatuses.CANCELLED] },
      }),
    )
      .select("appointmentId metadata")
      .sort({ "metadata.ring.startedAt": -1 })
      .limit(3)
      .lean();

    for (const session of sessions) {
      const ring = readRing(session.metadata);
      if (!ring || ringStatus(ring) !== "ringing") continue;

      const caller = await UserModel.findById(ring.fromUserId).select("name avatarUrl").lean();
      return {
        ringId: ring.id,
        appointmentId: String(session.appointmentId),
        fromRole: ring.fromRole,
        fromName:
          ring.fromRole === "doctor"
            ? withDoctorTitle(caller?.name ?? "Doctor")
            : (caller?.name ?? "Patient"),
        fromAvatarUrl: caller?.avatarUrl ?? null,
        startedAt: new Date(ring.startedAt).toISOString(),
      };
    }
    return null;
  }
}
