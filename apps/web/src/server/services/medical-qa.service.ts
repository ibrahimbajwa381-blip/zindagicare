import { randomUUID } from "crypto";
import { Types } from "mongoose";
import {
  connectDatabase,
  DoctorProfileModel,
  MedicalAnswerModel,
  MedicalQaReportModel,
  MedicalQuestionAttachmentModel,
  MedicalQuestionModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import { AppError, isAdmin, Roles, VerificationStatuses, type Role } from "@zindagi/shared";
import { unwrapEncryptedFile, wrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import {
  MEDICAL_QA_LIMITS,
  objectIdSchema,
  type CreateMedicalAnswerInput,
  type CreateMedicalQuestionInput,
  type ListMedicalQuestionsQuery,
  type MedicalQaCategory,
  type ModerateMedicalQaReportInput,
  type ReportMedicalQaInput,
} from "@zindagi/validators";
import { deleteObject, getObject, putObject } from "@/server/lib/object-storage";
import { processMedicalImage, sniffImageFormat } from "@/server/lib/medical-image-pipeline";
import { createDistributedRateLimiter } from "@/server/lib/distributed-rate-limit";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { recordAdminActivity } from "@/server/services/admin-activity.service";
import { scheduleMedicalQaPublish as safePublish } from "@/server/lib/schedule-medical-qa-publish";
import { scheduleAnswerNotification } from "@/server/lib/schedule-answer-notification";
import { cached, cacheKey } from "@/server/lib/cache";
import type {
  MedicalAnswerDto,
  MedicalQaProviderRole,
  MedicalQuestionDetailDto,
  MedicalQuestionPhotoDto,
  MedicalQuestionSummaryDto,
} from "@/features/medical-qa/types";

const STORAGE_NAMESPACE = "medical-qa-attachments" as const;
const QUERY_TIMEOUT_MS = 5000;
const MAX_ANSWERS_PER_THREAD = 200;

const HOUR = 60 * 60 * 1000;
export const MEDICAL_QA_RATE_LIMITS = {
  createQuestion: { limit: 5, windowMs: HOUR },
  createAnswer: { limit: 40, windowMs: HOUR },
  uploadAttachment: { limit: 20, windowMs: HOUR },
  viewAttachment: { limit: 300, windowMs: 10 * 60 * 1000 },
  report: { limit: 20, windowMs: HOUR },
  publicRead: { limit: 240, windowMs: 60 * 1000 },
  alertPreference: { limit: 30, windowMs: HOUR },
  /**
   * Live-update (SSE) connections per client IP. A tab reconnects about every
   * 270s, so this allows dozens of tabs behind one shared/carrier-NAT IP while
   * capping how many streams a single IP can keep open at once (≈ the limit).
   */
  eventStream: { limit: 60, windowMs: 5 * 60 * 1000 },
} as const;

/** One limiter per operation, created once per process (see withApiHandler's note). */
export const medicalQaLimiters = Object.fromEntries(
  Object.entries(MEDICAL_QA_RATE_LIMITS).map(([name, cfg]) => [
    name,
    createDistributedRateLimiter({ name: `mqa-${name}`, ...cfg }),
  ]),
) as Record<keyof typeof MEDICAL_QA_RATE_LIMITS, ReturnType<typeof createDistributedRateLimiter>>;

export type Viewer = { id: string; roles: Role[] } | null;
type ProviderRole = MedicalQaProviderRole;

const notFound = () => new AppError("Question not found", "NOT_FOUND", 404);
const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

/** Ids from the URL: malformed values never reach a Mongo filter. */
function parseId(value: string): Types.ObjectId {
  const parsed = objectIdSchema.safeParse(value);
  if (!parsed.success) throw notFound();
  return new Types.ObjectId(parsed.data);
}

const visibleQuestion = (id: Types.ObjectId) => ({ _id: id, deletedAt: null, moderationStatus: "visible" as const });


/**
 * The provider role a user may answer as, from trusted DB records only —
 * never from a client-sent role. Restricted (suspended), pending and
 * rejected providers are excluded.
 */
export async function resolveProviderRole(userId: string): Promise<ProviderRole | null> {
  const [doctor, staff] = await Promise.all([
    DoctorProfileModel.exists({ userId, verificationStatus: VerificationStatuses.APPROVED, deletedAt: null }),
    StaffProfileModel.findOne({
      userId,
      staffType: { $in: [Roles.NURSE, Roles.PHYSIOTHERAPIST] },
      verificationStatus: VerificationStatuses.APPROVED,
    })
      .select("staffType")
      .lean(),
  ]);
  if (doctor) return "doctor";
  if (staff) return staff.staffType as ProviderRole;
  return null;
}

/** Current verification for many authors at once (badges reflect today's status, not posting time). */
async function verifiedProviderIds(userIds: Types.ObjectId[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const [doctors, staff, activeUsers] = await Promise.all([
    DoctorProfileModel.find({ userId: { $in: userIds }, verificationStatus: VerificationStatuses.APPROVED, deletedAt: null })
      .select("userId")
      .lean(),
    StaffProfileModel.find({
      userId: { $in: userIds },
      staffType: { $in: [Roles.NURSE, Roles.PHYSIOTHERAPIST] },
      verificationStatus: VerificationStatuses.APPROVED,
    })
      .select("userId")
      .lean(),
    UserModel.find({ _id: { $in: userIds }, deletedAt: null, isActive: { $ne: false } }).select("_id").lean(),
  ]);
  const active = new Set(activeUsers.map((u) => String(u._id)));
  return new Set([...doctors, ...staff].map((p) => String(p.userId)).filter((id) => active.has(id)));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toSummary(q: {
  _id: Types.ObjectId;
  category: string;
  title: string;
  body: string;
  answerCount?: number | null;
  attachmentCount?: number | null;
  createdAt?: Date | null;
}): MedicalQuestionSummaryDto {
  return {
    id: String(q._id),
    category: q.category as MedicalQaCategory,
    title: q.title,
    excerpt: q.body.length > 180 ? `${q.body.slice(0, 180).trimEnd()}…` : q.body,
    answerCount: q.answerCount ?? 0,
    photoCount: q.attachmentCount ?? 0,
    createdAt: (q.createdAt ?? new Date()).toISOString(),
  };
}

async function answerDtos(
  answers: Array<{
    _id: Types.ObjectId;
    authorId: Types.ObjectId;
    authorRole: string;
    kind: string;
    body: string;
    createdAt?: Date | null;
  }>,
): Promise<MedicalAnswerDto[]> {
  const providerIds = [...new Set(answers.filter((a) => a.kind === "answer").map((a) => String(a.authorId)))].map(
    (id) => new Types.ObjectId(id),
  );
  const [verified, users] = await Promise.all([
    verifiedProviderIds(providerIds),
    UserModel.find({ _id: { $in: providerIds } }).select("name").lean(),
  ]);
  const names = new Map(users.map((u) => [String(u._id), safeDisplayText(u.name) ?? ""]));

  return answers.map((a) => {
    const isFollowUp = a.kind === "follow_up";
    return {
      id: String(a._id),
      kind: isFollowUp ? "follow_up" : "answer",
      body: a.body,
      createdAt: (a.createdAt ?? new Date()).toISOString(),
      author: isFollowUp
        ? { displayName: "", role: "patient", verified: false }
        : {
            displayName: names.get(String(a.authorId)) ?? "",
            role: a.authorRole as ProviderRole,
            verified: verified.has(String(a.authorId)),
          },
    };
  });
}

async function canViewPrivatePhotos(viewer: Viewer, authorId: Types.ObjectId): Promise<boolean> {
  if (!viewer) return false;
  if (String(authorId) === viewer.id) return true;
  if (isAdmin(viewer.roles)) return true;
  return (await resolveProviderRole(viewer.id)) !== null;
}

export const MedicalQaService = {
  async listQuestions(viewer: Viewer, query: ListMedicalQuestionsQuery) {
    await connectDatabase();
    const filter: Record<string, unknown> = { moderationStatus: "visible", deletedAt: null };
    if (query.category) filter.category = query.category;
    if (query.filter === "unanswered") filter.answerCount = 0;
    if (query.filter === "mine") {
      if (!viewer) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
      filter.authorId = new Types.ObjectId(viewer.id);
    }
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [{ title: pattern }, { body: pattern }];
    }
    // Total is only needed for the first page header; later pages skip the count.
    const countFilter = query.cursor ? null : { ...filter };
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };

    const [rows, total] = await Promise.all([
      MedicalQuestionModel.find(filter)
        .sort({ _id: -1 })
        .limit(query.limit + 1)
        .select("category title body answerCount attachmentCount createdAt")
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean(),
      countFilter
        ? MedicalQuestionModel.countDocuments(countFilter).maxTimeMS(QUERY_TIMEOUT_MS)
        : Promise.resolve(null),
    ]);

    const page = rows.slice(0, query.limit);
    return {
      items: page.map(toSummary),
      nextCursor: rows.length > query.limit ? String(page[page.length - 1]._id) : null,
      total,
    };
  },

  /** Newest public questions for the home page; public data, briefly cached. */
  async latestPublic(limit = 3): Promise<MedicalQuestionSummaryDto[]> {
    return cached(cacheKey("medical-qa-latest", limit), { ttl: 60, tags: [] }, async () => {
      const { items } = await MedicalQaService.listQuestions(null, { filter: "all", limit });
      return items;
    });
  },

  async getQuestion(viewer: Viewer, questionId: string): Promise<MedicalQuestionDetailDto> {
    await connectDatabase();
    const id = parseId(questionId);
    const q = await MedicalQuestionModel.findOne(visibleQuestion(id)).maxTimeMS(QUERY_TIMEOUT_MS).lean();
    if (!q) throw notFound();

    const [answers, attachments, canSeePhotos, viewerProviderRole] = await Promise.all([
      MedicalAnswerModel.find({ questionId: id, moderationStatus: "visible", deletedAt: null })
        .sort({ createdAt: 1 })
        .limit(MAX_ANSWERS_PER_THREAD)
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean(),
      MedicalQuestionAttachmentModel.find({ questionId: id, deletedAt: null })
        .select("_id width height")
        .sort({ createdAt: 1 })
        .lean(),
      canViewPrivatePhotos(viewer, q.authorId),
      viewer ? resolveProviderRole(viewer.id) : Promise.resolve(null),
    ]);

    const isOwner = !!viewer && String(q.authorId) === viewer.id;
    const summary = toSummary(q);
    return {
      question: {
        id: summary.id,
        category: summary.category,
        title: summary.title,
        body: q.body,
        answerCount: summary.answerCount,
        photoCount: attachments.length,
        createdAt: summary.createdAt,
      },
      answers: await answerDtos(answers),
      photos: canSeePhotos
        ? attachments.map((a) => ({
            id: String(a._id),
            url: `/api/v1/medical-questions/${String(id)}/attachments/${String(a._id)}`,
            width: a.width,
            height: a.height,
          }))
        : null,
      viewer: {
        isOwner,
        canAnswer: !isOwner && viewerProviderRole !== null,
        canFollowUp: isOwner,
        canDelete: isOwner || (!!viewer && isAdmin(viewer.roles)),
        canReport: !!viewer && !isOwner,
        isSignedIn: !!viewer,
      },
    };
  },

  async createQuestion(viewer: NonNullable<Viewer>, input: CreateMedicalQuestionInput) {
    await connectDatabase();
    const authorId = new Types.ObjectId(viewer.id);

    if (input.idempotencyKey) {
      await MedicalQuestionModel.init();
      const existing = await MedicalQuestionModel.findOne({ authorId, idempotencyKey: input.idempotencyKey }).lean();
      if (existing) return toSummary(existing);
    }

    try {
      const doc = await MedicalQuestionModel.create({
        authorId,
        category: input.category,
        title: input.title,
        body: input.body,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      });
      return toSummary(doc.toObject());
    } catch (e) {
      if (input.idempotencyKey && isDuplicateKey(e)) {
        const existing = await MedicalQuestionModel.findOne({ authorId, idempotencyKey: input.idempotencyKey }).lean();
        if (existing) return toSummary(existing);
      }
      throw e;
    }
  },

  async createAnswer(viewer: NonNullable<Viewer>, questionId: string, input: CreateMedicalAnswerInput): Promise<MedicalAnswerDto> {
    await connectDatabase();
    const id = parseId(questionId);
    const q = await MedicalQuestionModel.findOne(visibleQuestion(id)).select("authorId").lean();
    if (!q) throw notFound();

    const isOwner = String(q.authorId) === viewer.id;
    const providerRole = isOwner ? null : await resolveProviderRole(viewer.id);
    if (!isOwner && !providerRole) {
      throw new AppError(
        "Only verified doctors, nurses and physiotherapists can answer questions",
        "FORBIDDEN",
        403,
      );
    }

    const authorId = new Types.ObjectId(viewer.id);
    const kind = isOwner ? "follow_up" : "answer";
    const findExisting = async () => {
      const existing = await MedicalAnswerModel.findOne({ authorId, idempotencyKey: input.idempotencyKey }).lean();
      if (existing && !existing.questionId.equals(id)) {
        throw new AppError("This request was already used for another question", "CONFLICT", 409);
      }
      return existing;
    };

    if (input.idempotencyKey) {
      await MedicalAnswerModel.init();
      const existing = await findExisting();
      if (existing) return (await answerDtos([existing]))[0];
    }

    let created;
    try {
      created = await MedicalAnswerModel.create({
        questionId: id,
        authorId,
        authorRole: providerRole ?? "patient",
        kind,
        body: input.body,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      });
    } catch (e) {
      if (input.idempotencyKey && isDuplicateKey(e)) {
        const existing = await findExisting();
        if (existing) return (await answerDtos([existing]))[0];
      }
      throw e;
    }

    await MedicalQuestionModel.updateOne(
      { _id: id },
      { $set: { lastActivityAt: new Date() }, ...(kind === "answer" ? { $inc: { answerCount: 1 } } : {}) },
    );

    safePublish({ type: "answer_created", questionId: String(id), answerId: String(created._id) });
    // Tell the patient (bell + push). Only new answers: an idempotent replay
    // returned earlier, and the author's own follow-ups don't notify them.
    if (kind === "answer") scheduleAnswerNotification(String(created._id));
    return (await answerDtos([created.toObject()]))[0];
  },

  async deleteQuestion(viewer: NonNullable<Viewer>, questionId: string) {
    await connectDatabase();
    const id = parseId(questionId);
    const q = await MedicalQuestionModel.findOne({ _id: id, deletedAt: null }).select("authorId").lean();
    if (!q) throw notFound();
    if (String(q.authorId) !== viewer.id && !isAdmin(viewer.roles)) {
      throw new AppError("You can only delete your own questions", "FORBIDDEN", 403);
    }
    const now = new Date();
    // Soft delete only. Stored photo objects are kept until a retention policy is
    // agreed (legal/clinical review); they become unreachable through the API now.
    await Promise.all([
      MedicalQuestionModel.updateOne({ _id: id }, { $set: { deletedAt: now } }),
      MedicalQuestionAttachmentModel.updateMany({ questionId: id, deletedAt: null }, { $set: { deletedAt: now } }),
    ]);
    safePublish({ type: "question_updated", questionId: String(id) });
    return { deleted: true };
  },

  /** Owner-only check run before the upload body is read. */
  async assertCanAttach(viewer: NonNullable<Viewer>, questionId: string) {
    await connectDatabase();
    const id = parseId(questionId);
    const q = await MedicalQuestionModel.findOne(visibleQuestion(id)).select("authorId").lean();
    if (!q) throw notFound();
    if (String(q.authorId) !== viewer.id) {
      throw new AppError("You can only add photos to your own question", "FORBIDDEN", 403);
    }
  },

  async addAttachment(viewer: NonNullable<Viewer>, questionId: string, original: Buffer): Promise<MedicalQuestionPhotoDto> {
    await this.assertCanAttach(viewer, questionId);
    const id = new Types.ObjectId(questionId);
    const ownerId = new Types.ObjectId(viewer.id);

    // Atomic slot reservation keeps the per-question limit under concurrent uploads.
    const reserved = await MedicalQuestionModel.findOneAndUpdate(
      { ...visibleQuestion(id), authorId: ownerId, attachmentCount: { $lt: MEDICAL_QA_LIMITS.maxAttachments } },
      { $inc: { attachmentCount: 1 } },
      { projection: { _id: 1 } },
    ).lean();
    if (!reserved) {
      throw new AppError(
        `You can add up to ${MEDICAL_QA_LIMITS.maxAttachments} photos per question`,
        "ATTACHMENT_LIMIT",
        400,
      );
    }

    const releaseSlot = () =>
      MedicalQuestionModel.updateOne({ _id: id, attachmentCount: { $gt: 0 } }, { $inc: { attachmentCount: -1 } }).catch(
        () => {},
      );

    try {
      const processed = await processMedicalImage(original);
      const storageKey = `${String(id)}/${randomUUID()}.webp`;

      try {
        await putObject(STORAGE_NAMESPACE, storageKey, wrapEncryptedFile(processed.buffer), processed.contentType);
      } catch {
        throw new AppError("Photo storage is temporarily unavailable. Please try again.", "STORAGE_UNAVAILABLE", 503);
      }

      let doc;
      try {
        doc = await MedicalQuestionAttachmentModel.create({
          questionId: id,
          ownerId,
          storageKey,
          contentType: processed.contentType,
          bytes: processed.bytes,
          originalBytes: processed.originalBytes,
          width: processed.width,
          height: processed.height,
        });
      } catch (e) {
        // MongoDB and Supabase are separate systems — compensate so no orphan object remains.
        await deleteObject(STORAGE_NAMESPACE, storageKey).catch(() => {
          console.error("[medical-qa] orphaned attachment object could not be removed", { questionId: String(id) });
        });
        throw e;
      }

      safePublish({ type: "question_updated", questionId: String(id) });
      return {
        id: String(doc._id),
        url: `/api/v1/medical-questions/${String(id)}/attachments/${String(doc._id)}`,
        width: doc.width,
        height: doc.height,
      };
    } catch (e) {
      await releaseSlot();
      throw e;
    }
  },

  async readAttachment(viewer: NonNullable<Viewer>, questionId: string, attachmentId: string) {
    await connectDatabase();
    const qid = parseId(questionId);
    const aid = parseId(attachmentId);

    const q = await MedicalQuestionModel.findOne({ _id: qid, deletedAt: null }).select("authorId").lean();
    if (!q) throw notFound();
    // Authorize at the question level first so attachment ids can't be probed.
    if (!(await canViewPrivatePhotos(viewer, q.authorId))) {
      throw new AppError("Photos are only visible to the patient and verified providers", "FORBIDDEN", 403);
    }

    // Scoped to this question: an attachment id from another thread is simply not found.
    const att = await MedicalQuestionAttachmentModel.findOne({ _id: aid, questionId: qid, deletedAt: null }).lean();
    if (!att) throw new AppError("Photo not found", "NOT_FOUND", 404);

    const buffer = unwrapEncryptedFile(await getObject(STORAGE_NAMESPACE, att.storageKey));
    if (sniffImageFormat(buffer) !== "webp") {
      throw new AppError("Photo not found", "NOT_FOUND", 404);
    }
    return { buffer, contentType: "image/webp" as const };
  },

  async report(viewer: NonNullable<Viewer>, questionId: string, input: ReportMedicalQaInput) {
    await connectDatabase();
    const qid = parseId(questionId);
    const targetId = new Types.ObjectId(input.targetId);
    const q = await MedicalQuestionModel.exists(visibleQuestion(qid));
    if (!q) throw notFound();

    const targetBelongsToThread =
      input.targetType === "question"
        ? targetId.equals(qid)
        : !!(await MedicalAnswerModel.exists({ _id: targetId, questionId: qid, deletedAt: null }));
    if (!targetBelongsToThread) throw new AppError("Content not found", "NOT_FOUND", 404);

    try {
      await MedicalQaReportModel.create({
        questionId: qid,
        targetType: input.targetType,
        targetId,
        reporterId: new Types.ObjectId(viewer.id),
        reason: input.reason,
        details: input.details,
      });
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
    }
    return { reported: true };
  },

  async listReports() {
    await connectDatabase();
    const reports = await MedicalQaReportModel.find({ status: "open" })
      .sort({ createdAt: -1 })
      .limit(100)
      .maxTimeMS(QUERY_TIMEOUT_MS)
      .lean();

    const questionIds = [...new Set(reports.map((r) => String(r.questionId)))].map((id) => new Types.ObjectId(id));
    const answerIds = reports.filter((r) => r.targetType === "answer").map((r) => r.targetId);
    const [questions, answers] = await Promise.all([
      MedicalQuestionModel.find({ _id: { $in: questionIds } }).select("title moderationStatus").lean(),
      MedicalAnswerModel.find({ _id: { $in: answerIds } }).select("body moderationStatus").lean(),
    ]);
    const qMap = new Map(questions.map((q) => [String(q._id), q]));
    const aMap = new Map(answers.map((a) => [String(a._id), a]));

    return {
      items: reports.map((r) => {
        const target = r.targetType === "answer" ? aMap.get(String(r.targetId)) : qMap.get(String(r.targetId));
        return {
          id: String(r._id),
          questionId: String(r.questionId),
          questionTitle: qMap.get(String(r.questionId))?.title ?? "",
          targetType: r.targetType,
          targetId: String(r.targetId),
          targetPreview: r.targetType === "answer" ? ((target as { body?: string })?.body ?? "").slice(0, 280) : "",
          targetHidden: target?.moderationStatus === "hidden",
          reason: r.reason,
          details: r.details ?? "",
          createdAt: (r.createdAt ?? new Date()).toISOString(),
        };
      }),
    };
  },

  async moderate(admin: NonNullable<Viewer>, input: ModerateMedicalQaReportInput) {
    await connectDatabase();
    const report = await MedicalQaReportModel.findById(input.reportId).lean();
    if (!report) throw new AppError("Report not found", "NOT_FOUND", 404);

    if (input.action === "hide" || input.action === "restore") {
      const [from, to] = input.action === "hide" ? (["visible", "hidden"] as const) : (["hidden", "visible"] as const);
      if (report.targetType === "question") {
        await MedicalQuestionModel.updateOne({ _id: report.targetId, moderationStatus: from }, { $set: { moderationStatus: to } });
      } else {
        const changed = await MedicalAnswerModel.findOneAndUpdate(
          { _id: report.targetId, moderationStatus: from },
          { $set: { moderationStatus: to } },
          { projection: { kind: 1, questionId: 1 } },
        ).lean();
        // Keep the public answer count in step with what is actually visible.
        if (changed?.kind === "answer") {
          await MedicalQuestionModel.updateOne(
            { _id: changed.questionId, ...(to === "hidden" ? { answerCount: { $gt: 0 } } : {}) },
            { $inc: { answerCount: to === "hidden" ? -1 : 1 } },
          );
        }
      }
      safePublish({ type: "question_updated", questionId: String(report.questionId) });
    }

    await MedicalQaReportModel.updateMany(
      { targetType: report.targetType, targetId: report.targetId, status: "open" },
      {
        $set: {
          status: input.action === "dismiss" ? "dismissed" : "actioned",
          resolvedBy: new Types.ObjectId(admin.id),
          resolvedAt: new Date(),
        },
      },
    );

    await recordAdminActivity({
      actor: admin.id,
      action: `medical_qa.${input.action}`,
      entityType: report.targetType === "answer" ? "medical_answer" : "medical_question",
      entityId: String(report.targetId),
      changes: { reportId: input.reportId, reason: report.reason, ...(input.note ? { note: input.note } : {}) },
    });
    return { ok: true };
  },
};
