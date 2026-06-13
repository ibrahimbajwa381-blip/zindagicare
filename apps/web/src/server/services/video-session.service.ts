import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
  UserModel,
  VideoSessionModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  AppointmentTypes,
  ErrorCodes,
  VIDEO_CONSULT_CONFIG,
  VideoSessionStatuses,
} from "@zindagi/shared";
import { createZoomMeeting } from "@/lib/zoom/api";
import { ZOOM_CONSULT_MEETING_TITLE } from "@/lib/zoom/branding";
import { getPublicZoomSdkKey, getZoomConfig, isZoomConfigured } from "@/lib/zoom/config";
import { generateZoomMeetingSdkSignature } from "@/lib/zoom/signature";
import type { VideoJoinPayload } from "@/features/consult/types";
import { mongoFilter } from "@/lib/mongo/query";

const ONLINE_TYPES = [AppointmentTypes.ONLINE, AppointmentTypes.SUNDAY_FREE] as const;

export type VideoParticipantRole = "patient" | "doctor";

type AppointmentRow = {
  _id: { toString(): string };
  patientId: { toString(): string };
  doctorId: { toString(): string };
  scheduledStart: Date;
  scheduledEnd: Date;
  status: string;
  type: string;
  isOnline?: boolean;
};

type ParticipantContext = {
  appointment: AppointmentRow;
  role: VideoParticipantRole;
};

function getJoinWindow(scheduledStart: Date, scheduledEnd: Date) {
  const joinOpensAt = new Date(
    scheduledStart.getTime() - VIDEO_CONSULT_CONFIG.joinEarlyMinutes * 60_000,
  );
  const joinClosesAt = new Date(
    scheduledEnd.getTime() + VIDEO_CONSULT_CONFIG.joinLateMinutes * 60_000,
  );
  const now = new Date();
  return {
    joinOpensAt,
    joinClosesAt,
    canJoin: now >= joinOpensAt && now <= joinClosesAt,
  };
}

function meetingDurationMinutes(start: Date, end: Date) {
  const mins = Math.ceil((end.getTime() - start.getTime()) / 60_000);
  return Math.max(mins, 10);
}

export class VideoSessionService {
  private static async ensureConnected() {
    await connectDatabase();
  }

  private static async resolveParticipant(
    userId: string,
    appointmentId: string,
  ): Promise<ParticipantContext> {
    await VideoSessionService.ensureConnected();

    const appointment = await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (
      !ONLINE_TYPES.includes(appointment.type as (typeof ONLINE_TYPES)[number]) &&
      !appointment.isOnline
    ) {
      throw new AppError("This appointment is not a video consult", ErrorCodes.VALIDATION, 400);
    }

    if (
      appointment.status !== AppointmentStatuses.CONFIRMED &&
      appointment.status !== AppointmentStatuses.IN_PROGRESS
    ) {
      throw new AppError("Consultation is not active", ErrorCodes.VALIDATION, 400);
    }

    const isPatient = appointment.patientId.toString() === userId;
    let role: VideoParticipantRole | null = isPatient ? "patient" : null;

    if (!role) {
      const doctor = await DoctorProfileModel.findById(appointment.doctorId).lean();
      if (doctor?.userId?.toString() === userId) {
        role = "doctor";
      }
    }

    if (!role) {
      throw new AppError("Forbidden", ErrorCodes.FORBIDDEN, 403);
    }

    return { appointment: appointment as AppointmentRow, role };
  }

  private static async ensureZoomSession(appointment: AppointmentRow) {
    const existing = await VideoSessionModel.findOne(
      mongoFilter({ appointmentId: appointment._id.toString() }),
    ).lean();

    const metadata = existing?.metadata as {
      meetingId?: number;
      passcode?: string;
      joinUrl?: string;
      startUrl?: string;
    } | null;

    if (existing && metadata?.meetingId) {
      return existing;
    }

    if (!isZoomConfigured()) {
      throw new AppError(
        "Video consultations are not configured. Contact support.",
        "SERVICE_UNAVAILABLE",
        503,
      );
    }

    const topic = ZOOM_CONSULT_MEETING_TITLE;
    const meeting = await createZoomMeeting({
      topic,
      startTime: appointment.scheduledStart,
      durationMinutes: meetingDurationMinutes(
        appointment.scheduledStart,
        appointment.scheduledEnd,
      ),
      timezone: VIDEO_CONSULT_CONFIG.defaultTimezone,
    });

    const sessionDoc = existing
      ? await VideoSessionModel.findByIdAndUpdate(
          existing._id,
          {
            $set: {
              channelName: String(meeting.id),
              provider: "zoom",
              status: VideoSessionStatuses.WAITING,
              metadata: {
                meetingId: meeting.id,
                passcode: meeting.password,
                joinUrl: meeting.join_url,
                startUrl: meeting.start_url,
                meetingTitle: topic,
              },
            },
          },
          { new: true },
        )
      : await VideoSessionModel.create({
          appointmentId: appointment._id.toString(),
          channelName: String(meeting.id),
          provider: "zoom",
          status: VideoSessionStatuses.WAITING,
          metadata: {
            meetingId: meeting.id,
            passcode: meeting.password,
            joinUrl: meeting.join_url,
            startUrl: meeting.start_url,
            meetingTitle: topic,
          },
        });

    if (!sessionDoc) {
      throw new AppError("Failed to create video session", "SERVICE_UNAVAILABLE", 503);
    }

    await AppointmentModel.updateOne(
      mongoFilter({ _id: appointment._id }),
      { $set: { videoSessionId: sessionDoc._id } },
    );

    return sessionDoc.toObject();
  }

  static async getJoinPayload(
    userId: string,
    appointmentId: string,
  ): Promise<VideoJoinPayload> {
    const { appointment, role } = await VideoSessionService.resolveParticipant(
      userId,
      appointmentId,
    );

    const { joinOpensAt, joinClosesAt, canJoin } = getJoinWindow(
      appointment.scheduledStart,
      appointment.scheduledEnd,
    );

    if (!canJoin) {
      throw new AppError(
        "Video room is not open yet. Join within the allowed window around your scheduled time.",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    const session = await VideoSessionService.ensureZoomSession(appointment);
    const metadata = session.metadata as {
      meetingId: number;
      passcode: string;
      joinUrl: string;
      startUrl?: string;
      meetingTitle?: string;
    };

    const user = await UserModel.findById(userId).lean();
    const doctor = await DoctorProfileModel.findById(appointment.doctorId)
      .populate("userId", "name")
      .lean();
    const patient = await UserModel.findById(appointment.patientId).lean();
    const doctorUser = doctor?.userId as { name?: string } | null;

    const { sdkKey, sdkSecret } = getZoomConfig();
    const publicSdkKey = getPublicZoomSdkKey() ?? sdkKey;
    const meetingNumber = String(metadata.meetingId);
    const zoomRole: 0 | 1 = role === "doctor" ? 1 : 0;
    const signature = generateZoomMeetingSdkSignature(
      sdkKey,
      sdkSecret,
      meetingNumber,
      zoomRole,
    );

    return {
      appointmentId: appointment._id.toString(),
      sessionId: session._id.toString(),
      role,
      userName: user?.name ?? (role === "doctor" ? "Doctor" : "Patient"),
      meetingNumber,
      passcode: metadata.passcode,
      signature,
      sdkKey: publicSdkKey,
      joinUrl: metadata.joinUrl,
      startUrl: role === "doctor" ? metadata.startUrl : undefined,
      scheduledStart: appointment.scheduledStart.toISOString(),
      scheduledEnd: appointment.scheduledEnd.toISOString(),
      counterpartName:
        role === "doctor"
          ? (patient?.name ?? "Patient")
          : (doctorUser?.name ?? "Doctor"),
      meetingTitle: metadata.meetingTitle ?? ZOOM_CONSULT_MEETING_TITLE,
      canJoin,
      joinOpensAt: joinOpensAt.toISOString(),
      joinClosesAt: joinClosesAt.toISOString(),
    };
  }

  static async recordJoin(userId: string, appointmentId: string) {
    const { appointment, role } = await VideoSessionService.resolveParticipant(
      userId,
      appointmentId,
    );

    const session = await VideoSessionModel.findOne(
      mongoFilter({ appointmentId: appointment._id.toString() }),
    );
    if (!session) {
      throw new AppError("Video session not found", ErrorCodes.NOT_FOUND, 404);
    }

    const now = new Date();
    const updates: Record<string, unknown> = {
      status: VideoSessionStatuses.ACTIVE,
    };

    if (role === "patient" && !session.patientJoinedAt) {
      updates.patientJoinedAt = now;
    }
    if (role === "doctor" && !session.doctorJoinedAt) {
      updates.doctorJoinedAt = now;
    }
    if (!session.startedAt) {
      updates.startedAt = now;
    }

    await VideoSessionModel.updateOne(mongoFilter({ _id: session._id }), { $set: updates });

    if (appointment.status === AppointmentStatuses.CONFIRMED) {
      await AppointmentModel.updateOne(
        mongoFilter({ _id: appointment._id }),
        { $set: { status: AppointmentStatuses.IN_PROGRESS } },
      );
    }
  }

  static async recordLeave(userId: string, appointmentId: string) {
    const { appointment } = await VideoSessionService.resolveParticipant(
      userId,
      appointmentId,
    );

    const session = await VideoSessionModel.findOne(
      mongoFilter({ appointmentId: appointment._id.toString() }),
    );
    if (!session || session.status === VideoSessionStatuses.COMPLETED) {
      return;
    }

    const endedAt = new Date();
    const startedAt = session.startedAt ?? session.createdAt;
    const durationSeconds = startedAt
      ? Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000))
      : 0;

    await VideoSessionModel.updateOne(
      mongoFilter({ _id: session._id }),
      {
        $set: {
          status: VideoSessionStatuses.COMPLETED,
          endedAt,
          durationSeconds,
        },
      },
    );
  }

  static async getSessionStatus(userId: string, appointmentId: string) {
    const { appointment, role } = await VideoSessionService.resolveParticipant(
      userId,
      appointmentId,
    );

    const session = await VideoSessionModel.findOne(
      mongoFilter({ appointmentId: appointment._id.toString() }),
    ).lean();

    const { joinOpensAt, joinClosesAt, canJoin } = getJoinWindow(
      appointment.scheduledStart,
      appointment.scheduledEnd,
    );

    return {
      appointmentId: appointment._id.toString(),
      role,
      appointmentStatus: appointment.status,
      videoStatus: session?.status ?? VideoSessionStatuses.WAITING,
      canJoin,
      joinOpensAt: joinOpensAt.toISOString(),
      joinClosesAt: joinClosesAt.toISOString(),
      scheduledStart: appointment.scheduledStart.toISOString(),
      scheduledEnd: appointment.scheduledEnd.toISOString(),
      zoomConfigured: isZoomConfigured(),
    };
  }
}
