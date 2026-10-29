import {
  AppointmentModel,
  ChatMessageModel,
  ChatThreadModel,
  connectDatabase,
  HomeVisitModel,
  PaymentModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentTypes,
  buildChatDirectKey,
  ChatMessageKinds,
  ChatThreadTypes,
  getIntakeFormInviteMessage,
  getIntakeFormSubmittedMessage,
  getReturningPatientConsultMessage,
  IntakeSources,
  normalizeIntakeLocale,
} from "@zindagi/shared";
import { MedicalIntakeService } from "@/server/services/medical-intake.service";
import { CareService } from "@/server/services/care/care.service";
import { accessForAppointment } from "@/server/services/care/sources/appointment.source";
import { homeVisitAccess } from "@/server/services/care/policy";
import {
  providerUserIdForProfileId,
  providerUserIdOf,
  type AppointmentProviderRef,
  type ProviderProfile,
  type ProviderRole,
} from "@/server/services/care/provider-registry";
import type { CareLink } from "@/server/services/care/types";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import type {
  AdminChatTranscriptDto,
  ChatContactDto,
  ChatMessageDto,
  ChatParticipantDto,
  ChatThreadDto,
} from "@/features/chat/types";
import { publishChatEvent } from "@/lib/realtime/chat-emitter";
import { mongoFilter } from "@/lib/mongo/query";
import { formatPhoneForDisplay, safeDisplayText } from "@/server/lib/decrypt-pii";
import { Types } from "mongoose";

function previewText(body: string) {
  const trimmed = body.trim();
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
}

function toIso(date?: Date | null) {
  return date ? date.toISOString() : undefined;
}

async function requireProviderUserId(appointment: AppointmentProviderRef): Promise<string> {
  const userId = await providerUserIdOf(appointment);
  if (!userId) {
    throw new AppError("Provider not found", "NOT_FOUND", 404);
  }
  return userId;
}

/**
 * Chat deep links may pass either a user id or a provider profile id.
 * Prefer an existing user; otherwise map the profile `_id` to its `userId`.
 */
async function resolveChatParticipantUserId(participantId: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(participantId)) return null;
  const user = await UserModel.findById(participantId).select("_id").lean();
  if (user) return user._id.toString();
  return providerUserIdForProfileId(participantId);
}

const PROVIDER_LABELS: Record<ProviderRole, string> = {
  doctor: "Doctor",
  herbalist: "Herbalist",
  nutritionist: "Nutritionist",
  nurse: "Nurse",
  physiotherapist: "Physiotherapist",
};

function providerDisplay(
  user: { name: string; avatarUrl?: string | null },
  provider: ProviderProfile,
) {
  return {
    name: user.name,
    avatarUrl:
      provider.role === "doctor"
        ? resolveDoctorPortrait(user.name, user.avatarUrl)
        : (user.avatarUrl ?? undefined),
    subtitle: provider.specialties.slice(0, 2).join(", ") || PROVIDER_LABELS[provider.role],
  };
}

async function batchEnrichParticipants(
  links: CareLink[],
): Promise<Map<string, ChatParticipantDto>> {
  if (links.length === 0) return new Map();

  const linkByUserId = new Map(links.map((link) => [link.counterpartUserId, link]));
  const users = await UserModel.find(mongoFilter({ _id: { $in: [...linkByUserId.keys()] } }))
    .select("name avatarUrl")
    .lean();

  const participants = new Map<string, ChatParticipantDto>();
  for (const user of users) {
    const id = user._id.toString();
    const link = linkByUserId.get(id);
    if (!link) continue;

    // `role` is the side of the consult: "doctor" covers every provider type.
    participants.set(
      id,
      link.counterpartIsProvider
        ? { id, ...providerDisplay(user, link.provider), role: "doctor" }
        : {
            id,
            name: user.name,
            avatarUrl: user.avatarUrl ?? undefined,
            role: "patient",
            subtitle: "Patient",
          },
    );
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

type PairThread = {
  participantIds: Array<{ toString(): string }>;
  lastMessageAt?: Date | null;
};

function pickNewerThread<T extends PairThread>(current: T, candidate: T) {
  const currentTime = current.lastMessageAt?.getTime() ?? 0;
  const candidateTime = candidate.lastMessageAt?.getTime() ?? 0;
  return candidateTime > currentTime ? candidate : current;
}

/** Newest thread per counterpart; legacy duplicates may exist until consolidated. */
function latestThreadByCounterpart<T extends PairThread>(threads: T[], viewerId: string) {
  const byCounterpart = new Map<string, T>();
  for (const thread of threads) {
    const counterpartId = otherParticipantId(thread, viewerId);
    if (!counterpartId) continue;
    const existing = byCounterpart.get(counterpartId);
    byCounterpart.set(counterpartId, existing ? pickNewerThread(existing, thread) : thread);
  }
  return byCounterpart;
}

function otherParticipantId(thread: PairThread, viewerId: string) {
  return thread.participantIds
    .map((participant) => participant.toString())
    .find((id) => id !== viewerId);
}

/** A failed unique-index build scans the whole collection, so retry it at most this often. */
const THREAD_INDEX_RETRY_MS = 5 * 60_000;
let threadIndexFailedAt = Number.NEGATIVE_INFINITY;

/**
 * Duplicate doctor–patient threads are prevented only by the unique
 * `directKey` / `appointmentId` indexes, which Mongoose builds in the
 * background after connecting. Make sure they exist before inserting a
 * thread, so simultaneous requests on a fresh or lagging database can't each
 * insert one. Thread creation is rare (first chat per pair) and this is a
 * no-op on the server when the indexes already exist.
 *
 * The build fails if duplicates already exist; chat keeps working (without
 * the guarantee) and the failure is logged without key values (user ids).
 */
async function ensureThreadUniqueIndexes() {
  if (Date.now() - threadIndexFailedAt < THREAD_INDEX_RETRY_MS) return;
  try {
    await ChatThreadModel.createIndexes();
  } catch (err) {
    threadIndexFailedAt = Date.now();
    const { code, codeName } = (err ?? {}) as { code?: number; codeName?: string };
    console.error("[chat] unique thread indexes unavailable; duplicate threads possible", { code, codeName });
  }
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

  // Drop the unique keys too: soft-deleted rows still count for the unique
  // indexes, and a leftover duplicate key would stop them from being built.
  await ChatThreadModel.updateMany(
    mongoFilter({ _id: { $in: duplicateIds } }),
    { $set: { deletedAt: new Date() }, $unset: { directKey: "", appointmentId: "" } },
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
  link: CareLink,
): Promise<ChatThreadDto> {
  const [participantsById, unreadCount, videoInfoById] = await Promise.all([
    batchEnrichParticipants([link]),
    countUnread(thread._id.toString(), viewerId),
    thread.appointmentId
      ? batchVideoAppointmentInfo([thread.appointmentId.toString()])
      : Promise.resolve(new Map<string, VideoAppointmentInfo>()),
  ]);
  const otherParticipant = participantsById.get(link.counterpartUserId);
  if (!otherParticipant) {
    throw new AppError("User not found", "NOT_FOUND", 404);
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
    unreadCount,
    isClosed: !link.writable,
    otherParticipant,
  };
}

function findUserThreads(userId: string): Promise<ThreadRow[]> {
  return ChatThreadModel.find(mongoFilter({ participantIds: userId, deletedAt: null }))
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();
}

/** One thread per linked counterpart; threads with people the user shares no consult with are hidden. */
function pairThreadsWithLinks(
  threads: ThreadRow[],
  links: Map<string, CareLink>,
  userId: string,
): { thread: ThreadRow; link: CareLink }[] {
  const rows: { thread: ThreadRow; link: CareLink }[] = [];
  for (const [counterpartId, thread] of latestThreadByCounterpart(threads, userId)) {
    const link = links.get(counterpartId);
    if (link) rows.push({ thread, link });
  }
  return rows;
}

/**
 * Finds or creates the pair's single thread. With an appointment, the thread
 * is pointed at it (and taken off any other thread); without one (home visits)
 * the thread keeps whatever appointment it already had.
 */
async function ensurePairThread(
  patientUserId: string,
  providerUserId: string,
  appointmentId?: string,
): Promise<string> {
  const directKey = buildChatDirectKey(patientUserId, providerUserId);

  let thread = await findExistingDirectThread(patientUserId, providerUserId);

  if (!thread) {
    await ensureThreadUniqueIndexes();
    try {
      const created = await ChatThreadModel.create({
        type: ChatThreadTypes.DIRECT,
        directKey,
        ...(appointmentId ? { appointmentId } : {}),
        participantIds: [patientUserId, providerUserId],
      });
      thread = created.toObject();
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) {
        const existing = await findExistingDirectThread(patientUserId, providerUserId);
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
    if (appointmentId) {
      await ChatThreadModel.updateMany(
        mongoFilter({ appointmentId, _id: { $ne: thread._id } }),
        { $unset: { appointmentId: "" } },
      );
    }
    await ChatThreadModel.updateOne(
      mongoFilter({ _id: thread._id }),
      {
        $set: {
          directKey,
          ...(appointmentId ? { appointmentId } : {}),
          type: ChatThreadTypes.DIRECT,
        },
      },
    );
    await consolidateDuplicateThreads(
      thread._id.toString(),
      patientUserId,
      providerUserId,
    );
  }

  return thread._id.toString();
}

/** Finds or creates the pair's thread and points it (and the appointment) at this consult. */
async function attachThreadToAppointment(appointment: {
  _id: { toString(): string };
  patientId: { toString(): string };
} & AppointmentProviderRef): Promise<string> {
  const appointmentId = appointment._id.toString();
  const providerUserId = await providerUserIdOf(appointment);
  if (!providerUserId) {
    throw new AppError("Provider not found", "NOT_FOUND", 404);
  }

  const threadId = await ensurePairThread(
    appointment.patientId.toString(),
    providerUserId,
    appointmentId,
  );
  await AppointmentModel.updateOne(
    mongoFilter({ _id: appointmentId }),
    { $set: { chatThreadId: threadId } },
  );
  return threadId;
}

export class ChatService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async listThreads(userId: string): Promise<ChatThreadDto[]> {
    await ChatService.ensureConnected();

    const [links, threads] = await Promise.all([
      CareService.linksFor(userId),
      findUserThreads(userId),
    ]);
    const rows = pairThreadsWithLinks(threads, links, userId);
    const threadIds = rows.map(({ thread }) => thread._id.toString());
    const appointmentIds = rows
      .map(({ thread }) => thread.appointmentId?.toString())
      .filter((id): id is string => !!id);

    const [participantsById, unreadByThreadId, videoInfoById] = await Promise.all([
      batchEnrichParticipants(rows.map(({ link }) => link)),
      batchCountUnread(threadIds, userId),
      batchVideoAppointmentInfo(appointmentIds),
    ]);

    return rows.flatMap(({ thread, link }) => {
      const otherParticipant = participantsById.get(link.counterpartUserId);

      // One orphaned thread (e.g. deleted account) must not blank the whole inbox.
      if (!otherParticipant) {
        console.error("[chat] listThreads skipped thread with missing participant", {
          threadId: thread._id.toString(),
        });
        return [];
      }

      const videoInfo = thread.appointmentId
        ? videoInfoById.get(thread.appointmentId.toString())
        : undefined;

      return [{
        id: thread._id.toString(),
        type: thread.type,
        appointmentId: thread.appointmentId?.toString(),
        appointmentType: videoInfo?.type,
        scheduledStart: videoInfo?.scheduledStart,
        scheduledEnd: videoInfo?.scheduledEnd,
        lastMessageAt: toIso(thread.lastMessageAt),
        lastMessagePreview: thread.lastMessagePreview ?? undefined,
        unreadCount: unreadByThreadId.get(thread._id.toString()) ?? 0,
        isClosed: !link.writable,
        otherParticipant,
      }];
    });
  }

  static async totalUnreadCount(userId: string): Promise<number> {
    await ChatService.ensureConnected();

    // Count unread across all of the viewer's threads while their consults are
    // resolved, then sum only the linked threads (one fewer sequential round trip).
    const threads = await findUserThreads(userId);
    const [links, unreadByThreadId] = await Promise.all([
      CareService.linksFor(userId),
      batchCountUnread(
        threads.map((thread) => thread._id.toString()),
        userId,
      ),
    ]);

    let total = 0;
    for (const { thread } of pairThreadsWithLinks(threads, links, userId)) {
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

    const link = await CareService.linkBetween(initiatorId, resolvedOtherUserId);
    if (!link) {
      throw new AppError(
        "Chat is available once you have a booked consultation together.",
        "FORBIDDEN",
        403,
      );
    }
    if (!link.provider.available) {
      throw new AppError("This provider is not available for chat", "FORBIDDEN", 403);
    }

    let threadId: string;
    if (link.appointmentId) {
      const appointment = await AppointmentModel.findById(link.appointmentId).lean();
      if (!appointment) {
        throw new AppError("Appointment not found", "NOT_FOUND", 404);
      }
      threadId = await attachThreadToAppointment(appointment);
    } else {
      // Only home visits link them: no appointment to anchor the thread to.
      threadId = await ensurePairThread(
        link.counterpartIsProvider ? initiatorId : resolvedOtherUserId,
        link.provider.userId,
      );
    }
    const thread = await ChatThreadModel.findById(threadId).lean();
    if (!thread) {
      throw new AppError("Chat not found", "NOT_FOUND", 404);
    }

    return toThreadDto(thread, initiatorId, link);
  }

  /** Opens the patient ↔ assigned staff thread for a home visit; null when the visit gives no chat access. */
  static async ensureHomeVisitThread(visitId: string): Promise<string | null> {
    await ChatService.ensureConnected();

    const visit = Types.ObjectId.isValid(visitId)
      ? await HomeVisitModel.findById(visitId)
          .select("patientId assignedStaffId status scheduledAt")
          .lean()
      : null;
    if (!visit?.assignedStaffId || homeVisitAccess(visit) === "none") return null;

    return ensurePairThread(visit.patientId.toString(), visit.assignedStaffId.toString());
  }

  static async ensureAppointmentThread(appointmentId: string) {
    await ChatService.ensureConnected();

    const appointment = await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new AppError("Appointment not found", "NOT_FOUND", 404);
    }

    if ((await accessForAppointment(appointment)) === "none") {
      throw new AppError(
        "Chat is only available for booked consultations",
        "FORBIDDEN",
        403,
      );
    }

    const threadId = await attachThreadToAppointment(appointment);

    const priorCompleted = await MedicalIntakeService.findLatestCompletedWithDoctor(
      appointment.patientId.toString(),
      appointment.doctorId.toString(),
      appointmentId,
    );
    if (priorCompleted) {
      await MedicalIntakeService.upgradeToCompletedFromPrior(
        appointmentId,
        priorCompleted,
      );
    }

    return threadId;
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

  /**
   * Admin-only read of the doctor–patient thread behind an appointment. Bypasses
   * the participant check, so only call it from admin-gated routes.
   */
  static async getAppointmentTranscriptForAdmin(
    appointmentId: string,
    limit = 500,
  ): Promise<AdminChatTranscriptDto> {
    await ChatService.ensureConnected();
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new AppError("Appointment not found", "NOT_FOUND", 404);
    }

    const appointment = await AppointmentModel.findById(appointmentId)
      .select("patientId doctorId providerRole providerProfileId chatThreadId")
      .lean();
    if (!appointment) {
      throw new AppError("Appointment not found", "NOT_FOUND", 404);
    }

    const patientUserId = appointment.patientId.toString();
    const doctorUserId = (await providerUserIdOf(appointment)) ?? undefined;

    let threadId = appointment.chatThreadId?.toString();
    if (!threadId) {
      const byAppointment = await ChatThreadModel.findOne(
        mongoFilter({ appointmentId, deletedAt: null }),
      )
        .select("_id")
        .lean();
      threadId = byAppointment?._id.toString();
    }
    if (!threadId && doctorUserId) {
      threadId = (await findExistingDirectThread(patientUserId, doctorUserId))?._id.toString();
    }
    if (!threadId) {
      return { threadId: null, messages: [], truncated: false };
    }

    const rows = await ChatMessageModel.find(mongoFilter({ threadId, deletedAt: null }))
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();
    const truncated = rows.length > limit;
    const slice = truncated ? rows.slice(0, limit) : rows;

    return {
      threadId,
      truncated,
      messages: slice.reverse().map((row) => {
        const senderId = row.senderId?.toString();
        const sender: "patient" | "doctor" | "system" =
          row.kind === ChatMessageKinds.SYSTEM || !senderId
            ? "system"
            : senderId === patientUserId
              ? "patient"
              : "doctor";
        return {
          id: row._id.toString(),
          sender,
          body: row.body ?? "",
          attachmentUrl: row.attachmentUrl ?? undefined,
          attachmentMime: row.attachmentMime ?? undefined,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    };
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
    const counterpartId = otherParticipantId(thread, senderId);
    const link = counterpartId
      ? await CareService.linkBetween(senderId, counterpartId)
      : null;
    if (!link?.writable) {
      throw new AppError("This chat is closed", "FORBIDDEN", 403);
    }

    const trimmed = body.trim();
    if (!trimmed && !attachment) {
      throw new AppError("Message cannot be empty", "VALIDATION", 400);
    }

    // Each upload gets a unique storage URL, so a resend with the same URL is a
    // client retry after a lost response: return the original, don't duplicate.
    // shortcut: two truly concurrent identical sends can both insert; needs a unique index to close.
    if (attachment) {
      const existing = await ChatMessageModel.findOne(
        mongoFilter({ threadId, senderId, attachmentUrl: attachment.url, deletedAt: null }),
      ).lean();
      if (existing) {
        return {
          id: existing._id.toString(),
          threadId,
          senderId,
          kind: existing.kind,
          body: existing.body ?? "",
          attachmentUrl: existing.attachmentUrl ?? undefined,
          attachmentMime: existing.attachmentMime ?? undefined,
          createdAt: existing.createdAt.toISOString(),
          isMine: true,
          readBy: (existing.readBy ?? []).map((r) => String(r.userId)),
        };
      }
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
    const doctorUserId = await requireProviderUserId(appointment);

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

  /** People the user can message: everyone they share a consult with, either side. */
  static async listContacts(
    userId: string,
    query?: string,
  ): Promise<ChatContactDto[]> {
    await ChatService.ensureConnected();

    const [links, threads] = await Promise.all([
      CareService.linksFor(userId),
      ChatThreadModel.find(mongoFilter({ participantIds: userId, deletedAt: null }))
        .select("participantIds lastMessageAt")
        .lean(),
    ]);
    if (links.size === 0) return [];

    const threadByCounterpart = latestThreadByCounterpart(threads, userId);
    const users = await UserModel.find(mongoFilter({ _id: { $in: [...links.keys()] } }))
      .select("name avatarUrl phone")
      .lean();

    const q = query?.trim().toLowerCase();
    const contacts: ChatContactDto[] = [];

    for (const user of users) {
      const id = user._id.toString();
      const link = links.get(id);
      if (!link) continue;

      let contact: Omit<ChatContactDto, "threadId">;
      let searchable: string[];
      if (link.counterpartIsProvider) {
        const display = providerDisplay(user, link.provider);
        contact = { id, name: display.name, avatarUrl: display.avatarUrl, subtitle: display.subtitle };
        searchable = [display.name, ...link.provider.specialties];
      } else {
        const name = safeDisplayText(user.name) ?? "Patient";
        const phone = formatPhoneForDisplay(user.phone);
        contact = { id, name, avatarUrl: user.avatarUrl ?? undefined, subtitle: phone ?? "Patient" };
        searchable = [name, phone ?? ""];
      }

      if (q && !searchable.some((text) => text.toLowerCase().includes(q))) continue;
      contacts.push({ ...contact, threadId: threadByCounterpart.get(id)?._id.toString() });
    }

    return contacts.sort((a, b) => a.name.localeCompare(b.name));
  }
}
