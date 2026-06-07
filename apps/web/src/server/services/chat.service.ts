import {
  AppointmentModel,
  ChatMessageModel,
  ChatThreadModel,
  connectDatabase,
  DoctorProfileModel,
  PaymentModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  AppointmentTypes,
  ChatThreadTypes,
  PaymentStatuses,
  Roles,
  VerificationStatuses,
} from "@zindagi/shared";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import type {
  ChatContactDto,
  ChatMessageDto,
  ChatParticipantDto,
  ChatThreadDto,
} from "@/features/chat/types";
import { publishChatEvent } from "@/lib/realtime/chat-emitter";
import { mongoFilter } from "@/lib/mongo/query";
import type { Types } from "mongoose";

/** Paid consult types that unlock doctor–patient chat (Sunday free is excluded). */
const CHAT_ELIGIBLE_APPOINTMENT_TYPES = [
  AppointmentTypes.ONLINE,
  AppointmentTypes.CLINIC,
  AppointmentTypes.HOME_VISIT,
] as const;

const CHAT_ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
  AppointmentStatuses.COMPLETED,
] as const;

function previewText(body: string) {
  const trimmed = body.trim();
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
}

function toIso(date?: Date | null) {
  return date ? date.toISOString() : undefined;
}

async function resolveDoctorUserId(doctorProfileId: string): Promise<string> {
  const profile = await DoctorProfileModel.findById(doctorProfileId).lean();
  if (!profile?.userId) {
    throw new AppError("Doctor not found", "NOT_FOUND", 404);
  }
  return profile.userId.toString();
}

async function resolveDoctorProfileId(doctorUserId: string): Promise<string> {
  const profile = await DoctorProfileModel.findOne(
    mongoFilter({ userId: doctorUserId }),
  ).lean();
  if (!profile) {
    throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  }
  return profile._id.toString();
}

async function isPaidAppointmentChatEligible(
  appointment: {
    type: string;
    status: string;
    paymentId?: { toString(): string } | null;
  },
): Promise<boolean> {
  if (
    !CHAT_ELIGIBLE_APPOINTMENT_TYPES.includes(
      appointment.type as (typeof CHAT_ELIGIBLE_APPOINTMENT_TYPES)[number],
    )
  ) {
    return false;
  }

  if (
    !CHAT_ACTIVE_APPOINTMENT_STATUSES.includes(
      appointment.status as (typeof CHAT_ACTIVE_APPOINTMENT_STATUSES)[number],
    )
  ) {
    return false;
  }

  if (appointment.paymentId) {
    const payment = await PaymentModel.findById(appointment.paymentId).lean();
    return payment?.status === PaymentStatuses.PAID;
  }

  return appointment.type !== AppointmentTypes.ONLINE;
}

async function findLatestEligibleAppointment(
  patientUserId: string,
  doctorProfileId: string,
) {
  const appointments = await AppointmentModel.find(
    mongoFilter({
      patientId: patientUserId,
      doctorId: doctorProfileId,
      type: { $in: CHAT_ELIGIBLE_APPOINTMENT_TYPES },
      status: { $in: CHAT_ACTIVE_APPOINTMENT_STATUSES },
      deletedAt: null,
    }),
  )
    .sort({ scheduledStart: -1 })
    .lean();

  for (const appointment of appointments) {
    if (await isPaidAppointmentChatEligible(appointment)) {
      return appointment;
    }
  }

  return null;
}

async function assertThreadParticipant(threadId: string, userId: string) {
  const thread = await ChatThreadModel.findOne(
    mongoFilter({ _id: threadId, participantIds: userId, deletedAt: null }),
  ).lean();

  if (!thread) {
    throw new AppError("Chat not found", "NOT_FOUND", 404);
  }

  return thread;
}

async function enrichParticipant(
  userId: Types.ObjectId | string,
  viewerId: string,
): Promise<ChatParticipantDto> {
  const id = userId.toString();
  const user = await UserModel.findById(id).lean();
  if (!user) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }

  const isDoctor = user.roles.includes(Roles.DOCTOR);
  if (isDoctor) {
    const profile = await DoctorProfileModel.findOne(
      mongoFilter({ userId: user._id }),
    ).lean();
    const specialties = profile?.specialties?.slice(0, 2).join(", ");
    return {
      id,
      name: user.name,
      avatarUrl: resolveDoctorPortrait(user.name, user.avatarUrl),
      role: "doctor",
      subtitle: specialties || "Doctor",
    };
  }

  return {
    id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? undefined,
    role: "patient",
    subtitle: id === viewerId ? "You" : "Patient",
  };
}

async function countUnread(threadId: string, userId: string) {
  return ChatMessageModel.countDocuments(
    mongoFilter({
      threadId,
      senderId: { $ne: userId },
      deletedAt: null,
      "readBy.userId": { $ne: userId },
    }),
  );
}

type ThreadRow = {
  _id: { toString(): string };
  type: string;
  appointmentId?: { toString(): string } | null;
  participantIds: Array<{ toString(): string }>;
  lastMessageAt?: Date | null;
  lastMessagePreview?: string | null;
  isClosed?: boolean | null;
};

async function toThreadDto(
  thread: ThreadRow,
  viewerId: string,
): Promise<ChatThreadDto> {
  const otherId = thread.participantIds
    .map((p) => p.toString())
    .find((id) => id !== viewerId);

  if (!otherId) {
    throw new AppError("Invalid chat participants", "INVALID_STATE", 500);
  }

  const [otherParticipant, unreadCount] = await Promise.all([
    enrichParticipant(otherId, viewerId),
    countUnread(thread._id.toString(), viewerId),
  ]);

  return {
    id: thread._id.toString(),
    type: thread.type,
    appointmentId: thread.appointmentId?.toString(),
    lastMessageAt: toIso(thread.lastMessageAt),
    lastMessagePreview: thread.lastMessagePreview ?? undefined,
    unreadCount,
    isClosed: !!thread.isClosed,
    otherParticipant,
  };
}

export class ChatService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async listThreads(userId: string): Promise<ChatThreadDto[]> {
    await ChatService.ensureConnected();

    const threads = await ChatThreadModel.find(
      mongoFilter({ participantIds: userId, deletedAt: null }),
    )
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const eligible: ThreadRow[] = [];
    for (const thread of threads) {
      if (!thread.appointmentId) continue;
      const appointment = await AppointmentModel.findById(thread.appointmentId).lean();
      if (appointment && (await isPaidAppointmentChatEligible(appointment))) {
        eligible.push(thread);
      }
    }

    return Promise.all(eligible.map((thread) => toThreadDto(thread, userId)));
  }

  static async getOrCreateDirectThread(
    initiatorId: string,
    otherUserId: string,
  ): Promise<ChatThreadDto> {
    await ChatService.ensureConnected();

    const [initiator, other] = await Promise.all([
      UserModel.findById(initiatorId).lean(),
      UserModel.findById(otherUserId).lean(),
    ]);

    if (!initiator || !other) {
      throw new AppError("User not found", "NOT_FOUND", 404);
    }

    const initiatorIsDoctor = initiator.roles.includes(Roles.DOCTOR);
    const initiatorIsPatient = initiator.roles.includes(Roles.PATIENT);
    const otherIsDoctor = other.roles.includes(Roles.DOCTOR);
    const otherIsPatient = other.roles.includes(Roles.PATIENT);

    if (
      !(
        (initiatorIsDoctor && otherIsPatient) ||
        (initiatorIsPatient && otherIsDoctor)
      )
    ) {
      throw new AppError("Chats are only between doctors and patients", "FORBIDDEN", 403);
    }

    const doctorUserId = initiatorIsDoctor ? initiatorId : otherUserId;
    const patientUserId = initiatorIsPatient ? initiatorId : otherUserId;

    const doctorProfile = await DoctorProfileModel.findOne(
      mongoFilter({ userId: doctorUserId }),
    ).lean();

    if (
      !doctorProfile?.isListed ||
      doctorProfile.verificationStatus !== VerificationStatuses.APPROVED
    ) {
      throw new AppError("Doctor is not available for chat", "FORBIDDEN", 403);
    }

    const paidAppointment = await findLatestEligibleAppointment(
      patientUserId,
      doctorProfile._id.toString(),
    );

    if (!paidAppointment) {
      throw new AppError(
        "Chat is available after a paid consultation booking. Sunday free consults do not include messaging.",
        "FORBIDDEN",
        403,
      );
    }

    const existingThread = await ChatThreadModel.findOne(
      mongoFilter({ appointmentId: paidAppointment._id }),
    ).lean();

    if (existingThread) {
      return toThreadDto(existingThread, initiatorId);
    }

    const threadId = await ChatService.ensureAppointmentThread(
      paidAppointment._id.toString(),
    );
    const thread = await ChatThreadModel.findById(threadId).lean();
    if (!thread) {
      throw new AppError("Chat not found", "NOT_FOUND", 404);
    }

    return toThreadDto(thread, initiatorId);
  }

  static async ensureAppointmentThread(appointmentId: string) {
    await ChatService.ensureConnected();

    const appointment = await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new AppError("Appointment not found", "NOT_FOUND", 404);
    }

    if (!(await isPaidAppointmentChatEligible(appointment))) {
      throw new AppError(
        "Chat is only available for paid consultations",
        "FORBIDDEN",
        403,
      );
    }

    let thread = await ChatThreadModel.findOne(
      mongoFilter({ appointmentId }),
    ).lean();

    if (!thread) {
      const doctorUserId = await resolveDoctorUserId(appointment.doctorId.toString());
      const patientUserId = appointment.patientId.toString();

      const created = await ChatThreadModel.create({
        type: ChatThreadTypes.APPOINTMENT,
        appointmentId,
        participantIds: [patientUserId, doctorUserId],
      });
      thread = created.toObject();

      await AppointmentModel.updateOne(
        mongoFilter({ _id: appointmentId }),
        { $set: { chatThreadId: thread._id } },
      );
    }

    return thread._id.toString();
  }

  static async listMessages(
    threadId: string,
    userId: string,
    options: { before?: string; limit?: number } = {},
  ): Promise<{ messages: ChatMessageDto[]; hasMore: boolean }> {
    await ChatService.ensureConnected();
    await assertThreadParticipant(threadId, userId);

    const limit = options.limit ?? 50;
    const filter: Record<string, unknown> = {
      threadId,
      deletedAt: null,
    };

    if (options.before) {
      const beforeMessage = await ChatMessageModel.findById(options.before).lean();
      if (beforeMessage?.createdAt) {
        filter.createdAt = { $lt: beforeMessage.createdAt };
      }
    }

    const rows = await ChatMessageModel.find(mongoFilter(filter))
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const messages: ChatMessageDto[] = slice
      .reverse()
      .map((row) => ({
        id: row._id.toString(),
        threadId: row.threadId.toString(),
        senderId: row.senderId.toString(),
        body: row.body ?? "",
        createdAt: row.createdAt.toISOString(),
        isMine: row.senderId.toString() === userId,
        readBy: (row.readBy ?? [])
          .map((r) => r.userId?.toString())
          .filter((id): id is string => !!id),
      }));

    return { messages, hasMore };
  }

  static async sendMessage(
    threadId: string,
    senderId: string,
    body: string,
  ): Promise<ChatMessageDto> {
    await ChatService.ensureConnected();

    const thread = await assertThreadParticipant(threadId, senderId);
    if (thread.isClosed) {
      throw new AppError("This chat is closed", "FORBIDDEN", 403);
    }

    const trimmed = body.trim();
    if (!trimmed) {
      throw new AppError("Message cannot be empty", "VALIDATION", 400);
    }

    const message = await ChatMessageModel.create({
      threadId,
      senderId,
      body: trimmed,
      readBy: [{ userId: senderId, readAt: new Date() }],
    });

    const now = new Date();
    await ChatThreadModel.updateOne(
      mongoFilter({ _id: threadId }),
      {
        $set: {
          lastMessageAt: now,
          lastMessagePreview: previewText(trimmed),
        },
      },
    );

    const dto: ChatMessageDto = {
      id: message._id.toString(),
      threadId,
      senderId,
      body: trimmed,
      createdAt: message.createdAt.toISOString(),
      isMine: true,
      readBy: [senderId],
    };

    const participantIds = thread.participantIds.map((p) => p.toString());
    publishChatEvent(participantIds, {
      type: "message",
      threadId,
      messageId: dto.id,
      senderId,
      body: trimmed,
      createdAt: dto.createdAt,
      lastMessagePreview: previewText(trimmed),
      lastMessageAt: now.toISOString(),
    });

    return dto;
  }

  static async markThreadRead(threadId: string, userId: string) {
    await ChatService.ensureConnected();
    const thread = await assertThreadParticipant(threadId, userId);

    const now = new Date();
    await ChatMessageModel.updateMany(
      mongoFilter({
        threadId,
        senderId: { $ne: userId },
        deletedAt: null,
        "readBy.userId": { $ne: userId },
      }),
      { $push: { readBy: { userId, readAt: now } } },
    );

    const participantIds = thread.participantIds.map((p) => p.toString());
    publishChatEvent(participantIds, {
      type: "read",
      threadId,
      readByUserId: userId,
    });

    return { ok: true };
  }

  static async listPatientContacts(
    patientId: string,
    query?: string,
  ): Promise<ChatContactDto[]> {
    await ChatService.ensureConnected();

    const appointments = await AppointmentModel.find(
      mongoFilter({
        patientId,
        type: { $in: CHAT_ELIGIBLE_APPOINTMENT_TYPES },
        status: { $in: CHAT_ACTIVE_APPOINTMENT_STATUSES },
        deletedAt: null,
      }),
    )
      .sort({ scheduledStart: -1 })
      .lean();

    const threads = await ChatThreadModel.find(
      mongoFilter({ participantIds: patientId, deletedAt: null, appointmentId: { $exists: true } }),
    ).lean();

    const threadByAppointment = new Map(
      threads.map((thread) => [thread.appointmentId?.toString(), thread._id.toString()]),
    );

    const seenDoctors = new Set<string>();
    const contacts: ChatContactDto[] = [];

    for (const appointment of appointments) {
      if (!(await isPaidAppointmentChatEligible(appointment))) continue;

      const doctorProfileId = appointment.doctorId.toString();
      if (seenDoctors.has(doctorProfileId)) continue;
      seenDoctors.add(doctorProfileId);

      const profile = await DoctorProfileModel.findById(doctorProfileId)
        .populate("userId", "name avatarUrl")
        .lean();
      const user = profile?.userId as {
        _id: Types.ObjectId;
        name?: string;
        avatarUrl?: string;
      } | null;
      if (!user) continue;

      const name = user.name ?? "Doctor";
      if (query?.trim()) {
        const q = query.trim().toLowerCase();
        const specialtyMatch = profile?.specialties?.some((s) =>
          s.toLowerCase().includes(q),
        );
        if (!name.toLowerCase().includes(q) && !specialtyMatch) continue;
      }

      const doctorUserId = user._id.toString();
      contacts.push({
        id: doctorUserId,
        name,
        avatarUrl: resolveDoctorPortrait(name, user.avatarUrl),
        subtitle: profile?.specialties?.slice(0, 2).join(", ") || "Doctor",
        threadId: threadByAppointment.get(appointment._id.toString()),
      });
    }

    return contacts;
  }

  static async listDoctorContacts(
    doctorUserId: string,
    query?: string,
  ): Promise<ChatContactDto[]> {
    await ChatService.ensureConnected();

    const doctorProfileId = await resolveDoctorProfileId(doctorUserId);

    const appointments = await AppointmentModel.find(
      mongoFilter({
        doctorId: doctorProfileId,
        type: { $in: CHAT_ELIGIBLE_APPOINTMENT_TYPES },
        status: { $in: CHAT_ACTIVE_APPOINTMENT_STATUSES },
        deletedAt: null,
      }),
    )
      .sort({ scheduledStart: -1 })
      .lean();

    const threads = await ChatThreadModel.find(
      mongoFilter({
        participantIds: doctorUserId,
        deletedAt: null,
        appointmentId: { $exists: true },
      }),
    ).lean();

    const threadByAppointment = new Map(
      threads.map((thread) => [thread.appointmentId?.toString(), thread._id.toString()]),
    );

    const seenPatients = new Set<string>();
    const contacts: ChatContactDto[] = [];

    for (const appointment of appointments) {
      if (!(await isPaidAppointmentChatEligible(appointment))) continue;

      const patientId = appointment.patientId.toString();
      if (seenPatients.has(patientId)) continue;
      seenPatients.add(patientId);

      const patient = await UserModel.findById(patientId)
        .select("name avatarUrl phone")
        .lean();
      if (!patient) continue;

      if (query?.trim()) {
        const q = query.trim().toLowerCase();
        if (
          !patient.name.toLowerCase().includes(q) &&
          !(patient.phone?.toLowerCase().includes(q) ?? false)
        ) {
          continue;
        }
      }

      contacts.push({
        id: patientId,
        name: patient.name,
        avatarUrl: patient.avatarUrl ?? undefined,
        subtitle: patient.phone ?? "Patient",
        threadId: threadByAppointment.get(appointment._id.toString()),
      });
    }

    return contacts.sort((a, b) => a.name.localeCompare(b.name));
  }
}
