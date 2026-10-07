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
  buildChatDirectKey,
  ChatMessageKinds,
  ChatThreadTypes,
  getIntakeFormInviteMessage,
  getIntakeFormSubmittedMessage,
  getReturningPatientConsultMessage,
  IntakeSources,
  normalizeIntakeLocale,
  PaymentStatuses,
  Roles,
  VerificationStatuses,
} from "@zindagi/shared";
import { MedicalIntakeService } from "@/server/services/medical-intake.service";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import type {
  ChatContactDto,
  ChatMessageDto,
  ChatParticipantDto,
  ChatThreadDto,
} from "@/features/chat/types";
import { publishChatEvent } from "@/lib/realtime/chat-emitter";
import { mongoFilter } from "@/lib/mongo/query";
import { formatPhoneForDisplay, safeDisplayText } from "@/server/lib/decrypt-pii";
import { Types } from "mongoose";

/** Consult types that unlock doctor–patient chat. */
const CHAT_ELIGIBLE_APPOINTMENT_TYPES = [
  AppointmentTypes.ONLINE,
  AppointmentTypes.URGENT_ONLINE,
  AppointmentTypes.CLINIC,
  AppointmentTypes.HOME_VISIT,
  AppointmentTypes.SUNDAY_FREE,
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

/**
 * Chat deep links may pass either a user id or a doctor profile id.
 * Prefer an existing user; otherwise map a DoctorProfile `_id` to its `userId`.
 */
async function resolveChatParticipantUserId(participantId: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(participantId)) return null;
  const user = await UserModel.findById(participantId).select("_id").lean();
  if (user) return user._id.toString();

  const profile = await DoctorProfileModel.findById(participantId)
    .select("userId")
    .lean();
  return profile?.userId?.toString() ?? null;
}

type AppointmentEligibilityRow = {
  type: string;
  status: string;
  paymentId?: { toString(): string } | null;
  doctorId?: { toString(): string };
  patientId?: { toString(): string };
};

function isPaidAppointmentChatEligibleSync(
  appointment: AppointmentEligibilityRow,
  paidByPaymentId: Map<string, boolean>,
): boolean {
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
    return paidByPaymentId.get(appointment.paymentId.toString()) ?? false;
  }

  return (
    appointment.type !== AppointmentTypes.ONLINE &&
    appointment.type !== AppointmentTypes.URGENT_ONLINE
  );
}

async function batchPaidStatusByPaymentId(
  paymentIds: string[],
): Promise<Map<string, boolean>> {
  if (paymentIds.length === 0) return new Map();

  const payments = await PaymentModel.find(
    mongoFilter({ _id: { $in: paymentIds } }),
  )
    .select("status")
    .lean();

  return new Map(
    payments.map((payment) => [
      payment._id.toString(),
      payment.status === PaymentStatuses.PAID,
    ]),
  );
}

function collectPaymentIds(appointments: AppointmentEligibilityRow[]) {
  return [
    ...new Set(
      appointments
        .map((appointment) => appointment.paymentId?.toString())
        .filter((id): id is string => !!id),
    ),
  ];
}

async function isPaidAppointmentChatEligible(
  appointment: AppointmentEligibilityRow,
): Promise<boolean> {
  if (!appointment.paymentId) {
    return isPaidAppointmentChatEligibleSync(appointment, new Map());
  }

  const paidByPaymentId = await batchPaidStatusByPaymentId([
    appointment.paymentId.toString(),
  ]);
  return isPaidAppointmentChatEligibleSync(appointment, paidByPaymentId);
}

async function buildEligibleDoctorUserIdsForPatient(
  patientUserId: string,
): Promise<Set<string>> {
  const appointments = await AppointmentModel.find(
    mongoFilter({
      patientId: patientUserId,
      type: { $in: CHAT_ELIGIBLE_APPOINTMENT_TYPES },
      status: { $in: CHAT_ACTIVE_APPOINTMENT_STATUSES },
      deletedAt: null,
    }),
  )
    .select("type status paymentId doctorId")
    .lean();

  if (appointments.length === 0) return new Set();

  // Payment status and doctor profiles are independent lookups, so fetch them
  // together and filter to the eligible doctors afterwards (saves a round trip).
  const candidateDoctorProfileIds = [
    ...new Set(appointments.map((appointment) => appointment.doctorId.toString())),
  ];
  const [paidByPaymentId, profiles] = await Promise.all([
    batchPaidStatusByPaymentId(collectPaymentIds(appointments)),
    DoctorProfileModel.find(
      mongoFilter({ _id: { $in: candidateDoctorProfileIds } }),
    )
      .select("userId")
      .lean(),
  ]);

  const eligibleDoctorProfileIds = new Set<string>();
  for (const appointment of appointments) {
    if (!isPaidAppointmentChatEligibleSync(appointment, paidByPaymentId)) {
      continue;
    }
    eligibleDoctorProfileIds.add(appointment.doctorId.toString());
  }

  return new Set(
    profiles
      .filter((profile) => eligibleDoctorProfileIds.has(profile._id.toString()))
      .map((profile) => profile.userId.toString()),
  );
}

async function buildEligiblePatientIdsForDoctor(
  doctorProfileId: string,
): Promise<Set<string>> {
  const appointments = await AppointmentModel.find(
    mongoFilter({
      doctorId: doctorProfileId,
      type: { $in: CHAT_ELIGIBLE_APPOINTMENT_TYPES },
      status: { $in: CHAT_ACTIVE_APPOINTMENT_STATUSES },
      deletedAt: null,
    }),
  )
    .select("type status paymentId patientId")
    .lean();

  const paidByPaymentId = await batchPaidStatusByPaymentId(
    collectPaymentIds(appointments),
  );

  const eligiblePatientIds = new Set<string>();
  for (const appointment of appointments) {
    if (isPaidAppointmentChatEligibleSync(appointment, paidByPaymentId)) {
      eligiblePatientIds.add(appointment.patientId.toString());
    }
  }

  return eligiblePatientIds;
}

async function batchEnrichParticipants(
  userIds: string[],
  viewerId: string,
): Promise<Map<string, ChatParticipantDto>> {
  if (userIds.length === 0) return new Map();

  const users = await UserModel.find(mongoFilter({ _id: { $in: userIds } }))
    .select("name avatarUrl roles")
    .lean();

  const doctorUserIds = users
    .filter((user) => user.roles.includes(Roles.DOCTOR))
    .map((user) => user._id.toString());

  const doctorProfiles =
    doctorUserIds.length > 0
      ? await DoctorProfileModel.find(
          mongoFilter({ userId: { $in: doctorUserIds } }),
        )
          .select("userId specialties")
          .lean()
      : [];

  const profileByUserId = new Map(
    doctorProfiles.map((profile) => [profile.userId.toString(), profile]),
  );

  const participants = new Map<string, ChatParticipantDto>();
  for (const user of users) {
    const id = user._id.toString();
    const isDoctor = user.roles.includes(Roles.DOCTOR);

    if (isDoctor) {
      const profile = profileByUserId.get(id);
      const specialties = profile?.specialties?.slice(0, 2).join(", ");
      participants.set(id, {
        id,
        name: user.name,
        avatarUrl: resolveDoctorPortrait(user.name, user.avatarUrl),
        role: "doctor",
        subtitle: specialties || "Doctor",
      });
      continue;
    }

    participants.set(id, {
      id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      role: "patient",
      subtitle: id === viewerId ? "You" : "Patient",
    });
  }

  return participants;
}

const VIDEO_CONSULT_APPOINTMENT_TYPES = [
  AppointmentTypes.ONLINE,
  AppointmentTypes.URGENT_ONLINE,
] as const;

type VideoAppointmentInfo = {
  type: string;
  scheduledStart?: string;
  scheduledEnd?: string;
};

async function batchVideoAppointmentInfo(
  appointmentIds: string[],
): Promise<Map<string, VideoAppointmentInfo>> {
  if (appointmentIds.length === 0) return new Map();

  const appointments = await AppointmentModel.find(
    mongoFilter({
      _id: { $in: appointmentIds },
      type: { $in: VIDEO_CONSULT_APPOINTMENT_TYPES },
    }),
  )
    .select("type scheduledStart scheduledEnd")
    .lean();

  return new Map(
    appointments.map((appointment) => [
      appointment._id.toString(),
      {
        type: appointment.type,
        scheduledStart: toIso(appointment.scheduledStart),
        scheduledEnd: toIso(appointment.scheduledEnd),
      },
    ]),
  );
}

async function batchCountUnread(
  threadIds: string[],
  userId: string,
): Promise<Map<string, number>> {
  if (threadIds.length === 0) return new Map();

  const userObjectId = new Types.ObjectId(userId);
  const rows = await ChatMessageModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        threadId: { $in: threadIds.map((id) => new Types.ObjectId(id)) },
        senderId: { $ne: userObjectId },
        deletedAt: null,
        readBy: { $not: { $elemMatch: { userId: userObjectId } } },
      },
    },
    { $group: { _id: "$threadId", count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
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
  if (!Types.ObjectId.isValid(threadId) || !Types.ObjectId.isValid(userId)) {
    throw new AppError("Chat not found", "NOT_FOUND", 404);
  }

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

async function findExistingDirectThread(
  patientUserId: string,
  doctorUserId: string,
) {
  const directKey = buildChatDirectKey(patientUserId, doctorUserId);

  const byKey = await ChatThreadModel.findOne(
    mongoFilter({ directKey, deletedAt: null }),
  ).lean();
  if (byKey) return byKey;

  return ChatThreadModel.findOne(
    mongoFilter({
      participantIds: { $all: [patientUserId, doctorUserId] },
      deletedAt: null,
    }),
  )
    .sort({ createdAt: 1 })
    .lean();
}

function pickNewerThread(current: ThreadRow, candidate: ThreadRow) {
  const currentTime = current.lastMessageAt?.getTime() ?? 0;
  const candidateTime = candidate.lastMessageAt?.getTime() ?? 0;
  return candidateTime > currentTime ? candidate : current;
}

async function mapThreadsByDoctorUserId(
  threads: ThreadRow[],
  patientId: string,
) {
  const threadByDoctorUser = new Map<string, string>();

  for (const thread of threads) {
    const doctorUserId = thread.participantIds
      .map((participant) => participant.toString())
      .find((id) => id !== patientId);
    if (!doctorUserId) continue;

    const existingThreadId = threadByDoctorUser.get(doctorUserId);
    if (!existingThreadId) {
      threadByDoctorUser.set(doctorUserId, thread._id.toString());
      continue;
    }

    const existing = threads.find(
      (row) => row._id.toString() === existingThreadId,
    );
    if (existing) {
      const preferred = pickNewerThread(existing, thread);
      threadByDoctorUser.set(doctorUserId, preferred._id.toString());
    }
  }

  return threadByDoctorUser;
}

async function mapThreadsByPatientUserId(
  threads: ThreadRow[],
  doctorUserId: string,
) {
  const threadByPatientUser = new Map<string, string>();

  for (const thread of threads) {
    const patientUserId = thread.participantIds
      .map((participant) => participant.toString())
      .find((id) => id !== doctorUserId);
    if (!patientUserId) continue;

    const existingThreadId = threadByPatientUser.get(patientUserId);
    if (!existingThreadId) {
      threadByPatientUser.set(patientUserId, thread._id.toString());
      continue;
    }

    const existing = threads.find(
      (row) => row._id.toString() === existingThreadId,
    );
    if (existing) {
      const preferred = pickNewerThread(existing, thread);
      threadByPatientUser.set(patientUserId, preferred._id.toString());
    }
  }

  return threadByPatientUser;
}

async function consolidateDuplicateThreads(
  canonicalThreadId: string,
  patientUserId: string,
  doctorUserId: string,
) {
  const duplicates = await ChatThreadModel.find(
    mongoFilter({
      participantIds: { $all: [patientUserId, doctorUserId] },
      _id: { $ne: canonicalThreadId },
      deletedAt: null,
    }),
  ).lean();

  if (duplicates.length === 0) return;

  const duplicateIds = duplicates.map((thread) => thread._id);
  await ChatMessageModel.updateMany(
    mongoFilter({ threadId: { $in: duplicateIds } }),
    { $set: { threadId: canonicalThreadId } },
  );

  await ChatThreadModel.updateMany(
    mongoFilter({ _id: { $in: duplicateIds } }),
    { $set: { deletedAt: new Date() } },
  );

  const latestMessage = await ChatMessageModel.findOne(
    mongoFilter({ threadId: canonicalThreadId, deletedAt: null }),
  )
    .sort({ createdAt: -1 })
    .lean();

  if (!latestMessage?.body) return;

  await ChatThreadModel.updateOne(
    mongoFilter({ _id: canonicalThreadId }),
    {
      $set: {
        lastMessageAt: latestMessage.createdAt,
        lastMessagePreview: previewText(latestMessage.body),
      },
    },
  );
}

async function countUnread(threadId: string, userId: string) {
  const userObjectId = new Types.ObjectId(userId);
  return ChatMessageModel.countDocuments(
    mongoFilter({
      threadId,
      senderId: { $ne: userObjectId },
      deletedAt: null,
      readBy: { $not: { $elemMatch: { userId: userObjectId } } },
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

  const [otherParticipant, unreadCount, videoInfoById] = await Promise.all([
    enrichParticipant(otherId, viewerId),
    countUnread(thread._id.toString(), viewerId),
    thread.appointmentId
      ? batchVideoAppointmentInfo([thread.appointmentId.toString()])
      : Promise.resolve(new Map<string, VideoAppointmentInfo>()),
  ]);
  const videoInfo = thread.appointmentId
    ? videoInfoById.get(thread.appointmentId.toString())
    : undefined;

  return {
    id: thread._id.toString(),
    type: thread.type,
    appointmentId: thread.appointmentId?.toString(),
    appointmentType: videoInfo?.type,
    scheduledStart: videoInfo?.scheduledStart,
    scheduledEnd: videoInfo?.scheduledEnd,
    lastMessageAt: toIso(thread.lastMessageAt),
    lastMessagePreview: thread.lastMessagePreview ?? undefined,
    unreadCount,
    isClosed: !!thread.isClosed,
    otherParticipant,
  };
}

async function loadViewerAndThreads(userId: string) {
  await connectDatabase();

  const [viewer, threads] = await Promise.all([
    UserModel.findById(userId).select("roles").lean(),
    ChatThreadModel.find(mongoFilter({ participantIds: userId, deletedAt: null }))
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean(),
  ]);

  return { viewer, threads };
}

async function buildEligibleOtherIdsForViewer(
  userId: string,
  viewerRoles: readonly string[],
): Promise<Set<string>> {
  return viewerRoles.includes(Roles.DOCTOR)
    ? buildEligiblePatientIdsForDoctor(await resolveDoctorProfileId(userId))
    : buildEligibleDoctorUserIdsForPatient(userId);
}

async function listEligibleThreadRowsForUser(userId: string): Promise<ThreadRow[]> {
  const { viewer, threads } = await loadViewerAndThreads(userId);
  if (!viewer) return [];

  const eligibleOtherIds = await buildEligibleOtherIdsForViewer(userId, viewer.roles);
  return dedupeEligibleThreads(threads, userId, eligibleOtherIds);
}

function dedupeEligibleThreads(
  threads: ThreadRow[],
  userId: string,
  eligibleOtherIds: Set<string>,
): ThreadRow[] {
  const deduped = new Map<string, ThreadRow>();
  for (const thread of threads) {
    const otherId = thread.participantIds
      .map((participant) => participant.toString())
      .find((id) => id !== userId);
    if (!otherId || !eligibleOtherIds.has(otherId)) continue;

    const existing = deduped.get(otherId);
    deduped.set(
      otherId,
      existing ? pickNewerThread(existing, thread) : thread,
    );
  }

  return [...deduped.values()];
}

export class ChatService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async listThreads(userId: string): Promise<ChatThreadDto[]> {
    await ChatService.ensureConnected();

    const threadRows = await listEligibleThreadRowsForUser(userId);
    const otherIds = threadRows
      .map((thread) =>
        thread.participantIds
          .map((participant) => participant.toString())
          .find((id) => id !== userId),
      )
      .filter((id): id is string => !!id);
    const threadIds = threadRows.map((thread) => thread._id.toString());
    const appointmentIds = threadRows
      .map((thread) => thread.appointmentId?.toString())
      .filter((id): id is string => !!id);

    const [participantsById, unreadByThreadId, videoInfoById] = await Promise.all([
      batchEnrichParticipants(otherIds, userId),
      batchCountUnread(threadIds, userId),
      batchVideoAppointmentInfo(appointmentIds),
    ]);

    return threadRows.map((thread) => {
      const otherId = thread.participantIds
        .map((participant) => participant.toString())
        .find((id) => id !== userId);
      const otherParticipant = otherId ? participantsById.get(otherId) : undefined;

      if (!otherParticipant) {
        throw new AppError("Invalid chat participants", "INVALID_STATE", 500);
      }

      const videoInfo = thread.appointmentId
        ? videoInfoById.get(thread.appointmentId.toString())
        : undefined;

      return {
        id: thread._id.toString(),
        type: thread.type,
        appointmentId: thread.appointmentId?.toString(),
        appointmentType: videoInfo?.type,
        scheduledStart: videoInfo?.scheduledStart,
        scheduledEnd: videoInfo?.scheduledEnd,
        lastMessageAt: toIso(thread.lastMessageAt),
        lastMessagePreview: thread.lastMessagePreview ?? undefined,
        unreadCount: unreadByThreadId.get(thread._id.toString()) ?? 0,
        isClosed: !!thread.isClosed,
        otherParticipant,
      };
    });
  }

  static async totalUnreadCount(userId: string): Promise<number> {
    await ChatService.ensureConnected();

    const { viewer, threads } = await loadViewerAndThreads(userId);
    if (!viewer) return 0;

    // Count unread across all of the viewer's threads while eligibility is
    // resolved, then sum only the eligible (deduped) threads. Same result as
    // counting eligible threads alone, one fewer sequential round trip.
    const [eligibleOtherIds, unreadByThreadId] = await Promise.all([
      buildEligibleOtherIdsForViewer(userId, viewer.roles),
      batchCountUnread(
        threads.map((thread) => thread._id.toString()),
        userId,
      ),
    ]);

    let total = 0;
    for (const thread of dedupeEligibleThreads(threads, userId, eligibleOtherIds)) {
      total += unreadByThreadId.get(thread._id.toString()) ?? 0;
    }
    return total;
  }

  static async getOrCreateDirectThread(
    initiatorId: string,
    otherUserId: string,
  ): Promise<ChatThreadDto> {
    await ChatService.ensureConnected();

    const resolvedOtherUserId = await resolveChatParticipantUserId(otherUserId);
    if (!resolvedOtherUserId) {
      throw new AppError("User not found", "NOT_FOUND", 404);
    }

    const [initiator, other] = await Promise.all([
      UserModel.findById(initiatorId).lean(),
      UserModel.findById(resolvedOtherUserId).lean(),
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

    // Dual-role clinical accounts include Roles.PATIENT. Do not resolve sides from
    // independent role flags — that maps both IDs to the initiator and breaks
    // doctor "Message patient" deep links. Try each valid pairing and keep the
    // first with an eligible paid appointment (doctor-as-initiator first).
    type PairAttempt = { doctorUserId: string; patientUserId: string };
    const pairAttempts: PairAttempt[] = [];
    if (initiatorIsDoctor && otherIsPatient) {
      pairAttempts.push({
        doctorUserId: initiatorId,
        patientUserId: resolvedOtherUserId,
      });
    }
    if (initiatorIsPatient && otherIsDoctor) {
      pairAttempts.push({
        doctorUserId: resolvedOtherUserId,
        patientUserId: initiatorId,
      });
    }

    let doctorUserId = "";
    let patientUserId = "";
    let paidAppointment: Awaited<ReturnType<typeof findLatestEligibleAppointment>> = null;
    let sawApprovedListedDoctor = false;

    for (const attempt of pairAttempts) {
      const doctorProfile = await DoctorProfileModel.findOne(
        mongoFilter({ userId: attempt.doctorUserId }),
      ).lean();

      if (
        !doctorProfile?.isListed ||
        doctorProfile.verificationStatus !== VerificationStatuses.APPROVED
      ) {
        continue;
      }

      sawApprovedListedDoctor = true;
      const appointment = await findLatestEligibleAppointment(
        attempt.patientUserId,
        doctorProfile._id.toString(),
      );

      if (appointment) {
        doctorUserId = attempt.doctorUserId;
        patientUserId = attempt.patientUserId;
        paidAppointment = appointment;
        break;
      }
    }

    if (!paidAppointment || !doctorUserId || !patientUserId) {
      if (!sawApprovedListedDoctor) {
        throw new AppError("Doctor is not available for chat", "FORBIDDEN", 403);
      }
      throw new AppError(
        "Chat is available after a paid consultation booking. Sunday free consults do not include messaging.",
        "FORBIDDEN",
        403,
      );
    }

    const existingThread = await findExistingDirectThread(
      patientUserId,
      doctorUserId,
    );

    if (existingThread) {
      await ChatThreadModel.updateMany(
        mongoFilter({ appointmentId: paidAppointment._id, _id: { $ne: existingThread._id } }),
        { $unset: { appointmentId: "" } },
      );
      await ChatThreadModel.updateOne(
        mongoFilter({ _id: existingThread._id }),
        {
          $set: {
            directKey: buildChatDirectKey(patientUserId, doctorUserId),
            appointmentId: paidAppointment._id,
            type: ChatThreadTypes.DIRECT,
          },
        },
      );
      await AppointmentModel.updateOne(
        mongoFilter({ _id: paidAppointment._id }),
        { $set: { chatThreadId: existingThread._id } },
      );
      await consolidateDuplicateThreads(
        existingThread._id.toString(),
        patientUserId,
        doctorUserId,
      );
      const refreshed = await ChatThreadModel.findById(existingThread._id).lean();
      if (!refreshed) {
        throw new AppError("Chat not found", "NOT_FOUND", 404);
      }
      return toThreadDto(refreshed, initiatorId);
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

    const doctorUserId = await resolveDoctorUserId(appointment.doctorId.toString());
    const patientUserId = appointment.patientId.toString();
    const directKey = buildChatDirectKey(patientUserId, doctorUserId);

    let thread = await findExistingDirectThread(patientUserId, doctorUserId);

    if (!thread) {
      try {
        const created = await ChatThreadModel.create({
          type: ChatThreadTypes.DIRECT,
          directKey,
          appointmentId,
          participantIds: [patientUserId, doctorUserId],
        });
        thread = created.toObject();
      } catch (err: unknown) {
        if ((err as { code?: number })?.code === 11000) {
          const existing = await findExistingDirectThread(patientUserId, doctorUserId);
          if (existing) {
            thread = existing;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    } else {
      await ChatThreadModel.updateMany(
        mongoFilter({ appointmentId, _id: { $ne: thread._id } }),
        { $unset: { appointmentId: "" } },
      );
      await ChatThreadModel.updateOne(
        mongoFilter({ _id: thread._id }),
        {
          $set: {
            directKey,
            appointmentId,
            type: ChatThreadTypes.DIRECT,
          },
        },
      );
      await consolidateDuplicateThreads(
        thread._id.toString(),
        patientUserId,
        doctorUserId,
      );
      const refreshed = await ChatThreadModel.findById(thread._id).lean();
      if (refreshed) thread = refreshed;
    }

    await AppointmentModel.updateOne(
      mongoFilter({ _id: appointmentId }),
      { $set: { chatThreadId: thread._id } },
    );

    const priorCompleted = await MedicalIntakeService.findLatestCompletedWithDoctor(
      patientUserId,
      appointment.doctorId.toString(),
      appointmentId,
    );
    if (priorCompleted) {
      await MedicalIntakeService.upgradeToCompletedFromPrior(
        appointmentId,
        priorCompleted,
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
      if (!Types.ObjectId.isValid(options.before)) {
        throw new AppError("Invalid cursor", "VALIDATION_ERROR", 400);
      }
      const beforeMessage = await ChatMessageModel.findOne(
        mongoFilter({ _id: options.before, threadId, deletedAt: null }),
      ).lean();
      if (!beforeMessage) {
        return { messages: [], hasMore: false };
      }
      filter.createdAt = { $lt: beforeMessage.createdAt };
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
        senderId: row.senderId?.toString(),
        kind: (row.kind ?? ChatMessageKinds.USER) as "user" | "system",
        body: row.body ?? "",
        attachmentUrl: row.attachmentUrl ?? undefined,
        attachmentMime: row.attachmentMime ?? undefined,
        createdAt: row.createdAt.toISOString(),
        isMine: !!row.senderId && row.senderId.toString() === userId,
        readBy: (row.readBy ?? [])
          .map((r) => r.userId?.toString())
          .filter((id): id is string => !!id),
      }));

    return { messages, hasMore };
  }

  static async assertParticipant(threadId: string, userId: string) {
    return assertThreadParticipant(threadId, userId);
  }

  static async sendMessage(
    threadId: string,
    senderId: string,
    body: string,
    _locale?: string,
    attachment?: { url: string; mime: string },
  ): Promise<ChatMessageDto> {
    await ChatService.ensureConnected();

    const thread = await assertThreadParticipant(threadId, senderId);
    if (thread.isClosed) {
      throw new AppError("This chat is closed", "FORBIDDEN", 403);
    }

    const trimmed = body.trim();
    if (!trimmed && !attachment) {
      throw new AppError("Message cannot be empty", "VALIDATION", 400);
    }

    const message = await ChatMessageModel.create({
      threadId,
      senderId,
      kind: ChatMessageKinds.USER,
      body: trimmed,
      attachmentUrl: attachment?.url,
      attachmentMime: attachment?.mime,
      readBy: [{ userId: senderId, readAt: new Date() }],
    });

    const now = new Date();
    const preview = trimmed ? previewText(trimmed) : "🎤 Voice note";
    await ChatThreadModel.updateOne(
      mongoFilter({ _id: threadId }),
      {
        $set: {
          lastMessageAt: now,
          lastMessagePreview: preview,
        },
      },
    );

    const dto: ChatMessageDto = {
      id: message._id.toString(),
      threadId,
      senderId,
      kind: ChatMessageKinds.USER,
      body: trimmed,
      attachmentUrl: attachment?.url,
      attachmentMime: attachment?.mime,
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
      kind: ChatMessageKinds.USER,
      body: trimmed,
      attachmentUrl: attachment?.url,
      attachmentMime: attachment?.mime,
      createdAt: dto.createdAt,
      lastMessagePreview: preview,
      lastMessageAt: now.toISOString(),
    });

    return dto;
  }

  /** Posts a message that appears as sent by the doctor in the patient's chat. */
  static async sendDoctorMessage(
    threadId: string,
    doctorUserId: string,
    body: string,
  ): Promise<ChatMessageDto> {
    await ChatService.ensureConnected();

    const thread = await ChatThreadModel.findOne(
      mongoFilter({ _id: threadId, deletedAt: null }),
    ).lean();
    if (!thread) {
      throw new AppError("Chat not found", "NOT_FOUND", 404);
    }

    const trimmed = body.trim();
    const message = await ChatMessageModel.create({
      threadId,
      senderId: doctorUserId,
      kind: ChatMessageKinds.USER,
      body: trimmed,
      readBy: [],
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
      senderId: doctorUserId,
      kind: ChatMessageKinds.USER,
      body: trimmed,
      createdAt: message.createdAt.toISOString(),
      isMine: false,
      readBy: [],
    };

    const participantIds = thread.participantIds.map((p) => p.toString());
    publishChatEvent(participantIds, {
      type: "message",
      threadId,
      messageId: dto.id,
      senderId: doctorUserId,
      kind: ChatMessageKinds.USER,
      body: trimmed,
      createdAt: dto.createdAt,
      lastMessagePreview: previewText(trimmed),
      lastMessageAt: now.toISOString(),
    });

    return dto;
  }

  /** Posts a system (assistant) message into a thread and publishes it live. */
  static async sendSystemMessage(
    threadId: string,
    body: string,
  ): Promise<ChatMessageDto> {
    await ChatService.ensureConnected();

    const thread = await ChatThreadModel.findOne(
      mongoFilter({ _id: threadId, deletedAt: null }),
    ).lean();
    if (!thread) {
      throw new AppError("Chat not found", "NOT_FOUND", 404);
    }

    const trimmed = body.trim();
    const message = await ChatMessageModel.create({
      threadId,
      kind: ChatMessageKinds.SYSTEM,
      body: trimmed,
      readBy: [],
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
      kind: ChatMessageKinds.SYSTEM,
      body: trimmed,
      createdAt: message.createdAt.toISOString(),
      isMine: false,
      readBy: [],
    };

    const participantIds = thread.participantIds.map((p) => p.toString());
    publishChatEvent(participantIds, {
      type: "message",
      threadId,
      messageId: dto.id,
      kind: ChatMessageKinds.SYSTEM,
      body: trimmed,
      createdAt: dto.createdAt,
      lastMessagePreview: previewText(trimmed),
      lastMessageAt: now.toISOString(),
    });

    return dto;
  }

  /**
   * Starts the pre-consult health form flow for a paid online appointment:
   * creates the intake and posts a doctor message linking to the intake page.
   * Idempotent — does nothing if the intake already exists.
   */
  static async startIntakeConversation(appointmentId: string) {
    await ChatService.ensureConnected();

    const existing = await MedicalIntakeService.getForAppointment(appointmentId);
    if (existing) return;

    const appointment = await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new AppError("Appointment not found", "NOT_FOUND", 404);
    }

    const threadId = await ChatService.ensureAppointmentThread(appointmentId);
    const doctorUserId = await resolveDoctorUserId(appointment.doctorId.toString());

    const payment = await PaymentModel.findOne(
      mongoFilter({ appointmentId }),
    ).lean();
    const paymentLocale = (payment?.metadata as { locale?: string } | undefined)
      ?.locale;

    const priorCompleted = await MedicalIntakeService.findLatestCompletedWithDoctor(
      appointment.patientId.toString(),
      appointment.doctorId.toString(),
      appointmentId,
    );

    if (priorCompleted) {
      const intake = await MedicalIntakeService.createCompletedFromPrior(
        appointmentId,
        priorCompleted,
        IntakeSources.FORM,
        paymentLocale,
      );
      await ChatService.sendDoctorMessage(
        threadId,
        doctorUserId,
        getReturningPatientConsultMessage(intake.locale),
      );
      return;
    }

    const intake = await MedicalIntakeService.createForAppointment(
      appointmentId,
      IntakeSources.FORM,
      paymentLocale,
      { questionSet: "paid_online" },
    );

    await ChatService.sendDoctorMessage(
      threadId,
      doctorUserId,
      getIntakeFormInviteMessage(intake.locale, appointmentId),
    );
  }

  static async sendIntakeFormThankYou(
    appointmentId: string,
    intake?: {
      locale: string;
      questions: Array<{ answer?: string }>;
    } | null,
  ): Promise<ChatMessageDto | null> {
    await ChatService.ensureConnected();

    const intakeDto =
      intake ?? (await MedicalIntakeService.getForAppointment(appointmentId));
    if (!intakeDto) return null;

    const hasAnyAnswer = intakeDto.questions.some((question) => !!question.answer);
    if (!hasAnyAnswer) return null;

    const appointment = await AppointmentModel.findById(appointmentId)
      .populate({
        path: "doctorId",
        select: "userId",
      })
      .select("chatThreadId doctorId")
      .lean();

    if (!appointment?.chatThreadId) return null;

    const doctorProfile = appointment.doctorId as { userId?: Types.ObjectId } | null;
    const doctorUserId = doctorProfile?.userId?.toString();
    if (!doctorUserId) return null;

    return ChatService.sendDoctorMessage(
      appointment.chatThreadId.toString(),
      doctorUserId,
      getIntakeFormSubmittedMessage(
        normalizeIntakeLocale(intakeDto.locale),
      ),
    );
  }

  static async markThreadRead(threadId: string, userId: string) {
    await ChatService.ensureConnected();
    const thread = await assertThreadParticipant(threadId, userId);

    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    await ChatMessageModel.updateMany(
      mongoFilter({
        threadId,
        senderId: { $ne: userObjectId },
        deletedAt: null,
        readBy: { $not: { $elemMatch: { userId: userObjectId } } },
      }),
      { $push: { readBy: { userId: userObjectId, readAt: now } } },
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

    const [appointments, threads] = await Promise.all([
      AppointmentModel.find(
        mongoFilter({
          patientId,
          type: { $in: CHAT_ELIGIBLE_APPOINTMENT_TYPES },
          status: { $in: CHAT_ACTIVE_APPOINTMENT_STATUSES },
          deletedAt: null,
        }),
      )
        .sort({ scheduledStart: -1 })
        .select("type status paymentId doctorId")
        .lean(),
      ChatThreadModel.find(mongoFilter({ participantIds: patientId, deletedAt: null }))
        .select("participantIds lastMessageAt")
        .lean(),
    ]);

    const threadByDoctorUser = await mapThreadsByDoctorUserId(threads, patientId);
    const paidByPaymentId = await batchPaidStatusByPaymentId(
      collectPaymentIds(appointments),
    );

    const seenDoctors = new Set<string>();
    const doctorProfileIds: string[] = [];

    for (const appointment of appointments) {
      if (!isPaidAppointmentChatEligibleSync(appointment, paidByPaymentId)) continue;

      const doctorProfileId = appointment.doctorId.toString();
      if (seenDoctors.has(doctorProfileId)) continue;
      seenDoctors.add(doctorProfileId);
      doctorProfileIds.push(doctorProfileId);
    }

    if (doctorProfileIds.length === 0) return [];

    const profiles = await DoctorProfileModel.find(
      mongoFilter({ _id: { $in: doctorProfileIds } }),
    )
      .populate("userId", "name avatarUrl")
      .lean();

    const contacts: ChatContactDto[] = [];
    const q = query?.trim().toLowerCase();

    for (const profile of profiles) {
      const user = profile.userId as {
        _id: Types.ObjectId;
        name?: string;
        avatarUrl?: string;
      } | null;
      if (!user) continue;

      const doctorUserId = user._id.toString();
      const name = user.name ?? "Doctor";
      if (q) {
        const specialtyMatch = profile.specialties?.some((specialty) =>
          specialty.toLowerCase().includes(q),
        );
        if (!name.toLowerCase().includes(q) && !specialtyMatch) continue;
      }

      contacts.push({
        id: doctorUserId,
        name,
        avatarUrl: resolveDoctorPortrait(name, user.avatarUrl),
        subtitle: profile.specialties?.slice(0, 2).join(", ") || "Doctor",
        threadId: threadByDoctorUser.get(doctorUserId),
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

    const [appointments, threads] = await Promise.all([
      AppointmentModel.find(
        mongoFilter({
          doctorId: doctorProfileId,
          type: { $in: CHAT_ELIGIBLE_APPOINTMENT_TYPES },
          status: { $in: CHAT_ACTIVE_APPOINTMENT_STATUSES },
          deletedAt: null,
        }),
      )
        .sort({ scheduledStart: -1 })
        .select("type status paymentId patientId")
        .lean(),
      ChatThreadModel.find(
        mongoFilter({
          participantIds: doctorUserId,
          deletedAt: null,
        }),
      )
        .select("participantIds lastMessageAt")
        .lean(),
    ]);

    const threadByPatientUser = await mapThreadsByPatientUserId(
      threads,
      doctorUserId,
    );
    const paidByPaymentId = await batchPaidStatusByPaymentId(
      collectPaymentIds(appointments),
    );

    const seenPatients = new Set<string>();
    const patientIds: string[] = [];

    for (const appointment of appointments) {
      if (!isPaidAppointmentChatEligibleSync(appointment, paidByPaymentId)) {
        continue;
      }

      const patientId = appointment.patientId.toString();
      if (seenPatients.has(patientId)) continue;
      seenPatients.add(patientId);
      patientIds.push(patientId);
    }

    if (patientIds.length === 0) return [];

    const patients = await UserModel.find(mongoFilter({ _id: { $in: patientIds } }))
      .select("name avatarUrl phone")
      .lean();

    const patientById = new Map(
      patients.map((patient) => [patient._id.toString(), patient]),
    );

    const contacts: ChatContactDto[] = [];
    const q = query?.trim().toLowerCase();

    for (const patientId of patientIds) {
      const patient = patientById.get(patientId);
      if (!patient) continue;

      if (q) {
        const patientName = safeDisplayText(patient.name) ?? "";
        const patientPhone = formatPhoneForDisplay(patient.phone) ?? "";
        if (
          !patientName.toLowerCase().includes(q) &&
          !patientPhone.toLowerCase().includes(q)
        ) {
          continue;
        }
      }

      const displayName = safeDisplayText(patient.name) ?? "Patient";
      const displayPhone = formatPhoneForDisplay(patient.phone);

      contacts.push({
        id: patientId,
        name: displayName,
        avatarUrl: patient.avatarUrl ?? undefined,
        subtitle: displayPhone ?? "Patient",
        threadId: threadByPatientUser.get(patientId),
      });
    }

    return contacts.sort((a, b) => a.name.localeCompare(b.name));
  }
}
