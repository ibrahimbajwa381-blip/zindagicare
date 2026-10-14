import { Types } from "mongoose";
import {
  connectDatabase,
  DoctorProfileModel,
  MedicalQaAlertModel,
  MedicalQaAlertPreferenceModel,
  MedicalQuestionModel,
  NotificationModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import { NotificationChannels, Roles, VerificationStatuses, type Role } from "@zindagi/shared";
import { objectIdSchema, type MedicalQaCategory } from "@zindagi/validators";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { sendExpoPushToUser, sendWebPushToUser } from "@/server/services/push.service";
import { resolveProviderRole } from "@/server/services/medical-qa.service";
import {
  allDoctorsRule,
  buildQuestionAlertContent,
  isQuietHours,
  QUESTION_ALERT_CONFIG as CFG,
  retryDelayMs,
  topicRecipientRule,
  type AlertRecipientRole,
  type QuestionAlertContent,
  type TopicRecipientRule,
} from "@/server/lib/medical-qa-alert-rules";

/**
 * New-question alerts to verified professionals.
 *
 * Flow (all after the question is saved, off the request path):
 *  1. Claim the question under a short lease (one worker at a time).
 *  2. Resolve recipients from trusted DB records only.
 *  3. Create one MedicalQaAlert + in-app Notification per recipient. Both use
 *     unique keys, so retries and concurrent workers never duplicate them.
 *  4. Attempt push (Expo + web, independently, each with a timeout), subject
 *     to quiet hours and a per-professional throttle. In-app is never skipped.
 *  5. Record the outcome; failed pushes are retried by `sweepPending` with
 *     backoff, up to `maxAttempts`.
 *
 * Delivery is best-effort: there is no durable queue in this project, so a
 * retry only happens when the sweep runs (after each new question is posted).
 */

type Recipient = { userId: Types.ObjectId; role: AlertRecipientRole };
type ProcessOptions = { now?: Date; pushTimeoutMs?: number };
type ProcessResult = { processed: false } | { processed: true; recipients: number; status: "done" | "failed" };

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Profile → user ids that currently match a topic rule (verification only). */
async function matchingProfiles(rule: TopicRecipientRule): Promise<Recipient[]> {
  if (rule.kind === "doctors") {
    const rows = await DoctorProfileModel.find({
      verificationStatus: VerificationStatuses.APPROVED,
      deletedAt: null,
      ...(rule.specialties ? { specialties: { $in: [...rule.specialties] } } : {}),
    })
      .select("userId")
      .limit(CFG.maxRecipients)
      .lean();
    return rows.map((r) => ({ userId: r.userId as Types.ObjectId, role: "doctor" }));
  }
  const rows = await StaffProfileModel.find({
    staffType: rule.staffType,
    verificationStatus: VerificationStatuses.APPROVED,
    deletedAt: null,
  })
    .select("userId")
    .limit(CFG.maxRecipients)
    .lean();
  return rows.map((r) => ({ userId: r.userId as Types.ObjectId, role: rule.staffType }));
}

const ROLE_FOR: Record<AlertRecipientRole, Role> = {
  doctor: Roles.DOCTOR,
  nurse: Roles.NURSE,
  physiotherapist: Roles.PHYSIOTHERAPIST,
};

/** Keeps only active, unbanned accounts holding the role, not opted out, not the author; de-duplicated. */
async function eligibleRecipients(
  candidates: Recipient[],
  authorId: Types.ObjectId,
  now: Date,
): Promise<Recipient[]> {
  const byId = new Map<string, Recipient>();
  for (const c of candidates) {
    if (!c.userId || c.userId.equals(authorId)) continue;
    byId.set(String(c.userId), c);
  }
  if (byId.size === 0) return [];
  const role = [...byId.values()][0].role;
  const userIds = [...byId.values()].map((c) => c.userId);

  const [users, optedOut] = await Promise.all([
    UserModel.find({
      _id: { $in: userIds },
      roles: ROLE_FOR[role],
      isActive: { $ne: false },
      deletedAt: null,
      $or: [{ bannedUntil: null }, { bannedUntil: { $lte: now } }],
    })
      .select("_id")
      .lean(),
    MedicalQaAlertPreferenceModel.find({ userId: { $in: userIds }, questionAlerts: false }).select("userId").lean(),
  ]);
  const excluded = new Set(optedOut.map((p) => String(p.userId)));
  return users.filter((u) => !excluded.has(String(u._id))).map((u) => byId.get(String(u._id))!);
}

async function resolveRecipients(
  question: { category: MedicalQaCategory; authorId: Types.ObjectId },
  now: Date,
): Promise<Recipient[]> {
  const rule = topicRecipientRule(question.category);
  const matched = await eligibleRecipients(await matchingProfiles(rule), question.authorId, now);
  const isAllDoctors = rule.kind === "doctors" && rule.specialties === null;
  if (matched.length > 0 || isAllDoctors) return matched;
  // No eligible specialist for this topic: don't leave the question unseen.
  return eligibleRecipients(await matchingProfiles(allDoctorsRule()), question.authorId, now);
}

/** Alert row + in-app notification, each created at most once per (question, recipient). */
async function ensureAlert(questionId: Types.ObjectId, recipient: Recipient, content: QuestionAlertContent) {
  try {
    await MedicalQaAlertModel.updateOne(
      { questionId, recipientId: recipient.userId },
      { $setOnInsert: { recipientRole: recipient.role, notificationId: new Types.ObjectId() } },
      { upsert: true },
    );
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
  }
  const alert = await MedicalQaAlertModel.findOne({ questionId, recipientId: recipient.userId })
    .select("notificationId")
    .lean();
  if (!alert?.notificationId) return;
  try {
    // Pre-assigned _id: a retry after a crash hits the duplicate key instead of a second notification.
    await NotificationModel.create({
      _id: alert.notificationId,
      userId: recipient.userId,
      channel: NotificationChannels.IN_APP,
      title: content.title,
      body: content.body,
      payload: content.payload,
      sentAt: new Date(),
    });
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
  }
}

/** Atomic, cross-instance throttle claim. False when this professional was pushed recently. */
async function claimPushSlot(userId: Types.ObjectId, now: Date): Promise<boolean> {
  const windowStart = new Date(now.getTime() - CFG.pushThrottle.windowMs);
  try {
    await MedicalQaAlertPreferenceModel.updateOne(
      { userId, $or: [{ lastPushAt: null }, { lastPushAt: { $lte: windowStart } }] },
      { $set: { lastPushAt: now }, $setOnInsert: { questionAlerts: true } },
      { upsert: true },
    );
    return true;
  } catch (e) {
    // The row exists with a recent lastPushAt, so the upsert collided on userId.
    if (isDuplicateKey(e)) return false;
    throw e;
  }
}

async function releasePushSlot(userId: Types.ObjectId, now: Date) {
  await MedicalQaAlertPreferenceModel.updateOne({ userId, lastPushAt: now }, { $unset: { lastPushAt: 1 } });
}

type PushOutcome = "sent" | "no_device" | "failed";

async function pushToRecipient(
  userId: Types.ObjectId,
  content: QuestionAlertContent,
  questionId: string,
  timeoutMs: number,
): Promise<{ outcome: PushOutcome; error?: string }> {
  const uid = String(userId);
  const [expo, web] = await Promise.allSettled([
    withTimeout(sendExpoPushToUser(uid, { title: content.title, body: content.body, data: content.payload }), timeoutMs),
    withTimeout(
      sendWebPushToUser(uid, { title: content.title, body: content.body, url: content.url, tag: `mqa-${questionId}` }),
      timeoutMs,
    ),
  ]);
  let sent = 0;
  let failed = 0;
  let error: string | undefined;
  for (const r of [expo, web]) {
    if (r.status === "fulfilled") {
      sent += r.value.sent;
      failed += r.value.failed;
    } else {
      failed += 1;
      error = r.reason instanceof Error && r.reason.message === "timeout" ? "timeout" : "provider_error";
    }
  }
  if (sent > 0) return { outcome: "sent" };
  if (failed > 0) return { outcome: "failed", error: error ?? "provider_rejected" };
  return { outcome: "no_device" };
}

export const MedicalQaAlerts = {
  async processQuestion(questionId: string, opts: ProcessOptions = {}): Promise<ProcessResult> {
    const parsed = objectIdSchema.safeParse(questionId);
    if (!parsed.success) return { processed: false };
    const now = opts.now ?? new Date();
    const timeoutMs = opts.pushTimeoutMs ?? CFG.pushTimeoutMs;
    await connectDatabase();
    const id = new Types.ObjectId(parsed.data);

    const q = await MedicalQuestionModel.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
        moderationStatus: "visible",
        alertStatus: { $in: ["pending", "failed", "processing"] },
        alertAttempts: { $lt: CFG.maxAttempts },
        $and: [
          { $or: [{ alertLeaseUntil: null }, { alertLeaseUntil: { $lte: now } }] },
          { $or: [{ alertNextAttemptAt: null }, { alertNextAttemptAt: { $lte: now } }] },
        ],
      },
      {
        $set: { alertStatus: "processing", alertLeaseUntil: new Date(now.getTime() + CFG.leaseMs) },
        $inc: { alertAttempts: 1 },
      },
      { returnDocument: "after", projection: { authorId: 1, category: 1, title: 1, answerCount: 1, alertAttempts: 1 } },
    ).lean();
    if (!q) return { processed: false };

    const attempt = q.alertAttempts ?? 1;
    try {
      const category = q.category as MedicalQaCategory;
      const content = buildQuestionAlertContent({ id: String(id), category, title: q.title });
      const recipients = await resolveRecipients({ category, authorId: q.authorId as Types.ObjectId }, now);
      await mapWithConcurrency(recipients, CFG.concurrency, (r) => ensureAlert(id, r, content));

      const due = await MedicalQaAlertModel.find({
        questionId: id,
        pushStatus: { $in: ["pending", "failed"] },
        pushAttempts: { $lt: CFG.maxAttempts },
      })
        .select("recipientId pushAttempts")
        .lean();
      const quiet = isQuietHours(now);
      const answeredAlready = (q.answerCount ?? 0) > 0;

      await mapWithConcurrency(due, CFG.concurrency, async (alert) => {
        const setStatus = (pushStatus: string, extra: Record<string, unknown> = {}) =>
          MedicalQaAlertModel.updateOne({ _id: alert._id }, { $set: { pushStatus, ...extra } });

        if (quiet) return setStatus("quiet_hours");
        // A retry for a question that already got an answer is no longer useful.
        if (answeredAlready && alert.pushAttempts > 0) return setStatus("skipped");
        const userId = alert.recipientId as Types.ObjectId;
        if (!(await claimPushSlot(userId, now))) return setStatus("throttled");

        const { outcome, error } = await pushToRecipient(userId, content, String(id), timeoutMs);
        if (outcome !== "sent") await releasePushSlot(userId, now);
        if (outcome === "failed") {
          return MedicalQaAlertModel.updateOne(
            { _id: alert._id },
            { $set: { pushStatus: "failed", lastError: error }, $inc: { pushAttempts: 1 } },
          );
        }
        return setStatus(outcome, { lastError: null });
      });

      const [recipientCount, stillFailing] = await Promise.all([
        MedicalQaAlertModel.countDocuments({ questionId: id }),
        MedicalQaAlertModel.exists({ questionId: id, pushStatus: "failed" }),
      ]);
      const status = stillFailing ? "failed" : "done";
      await MedicalQuestionModel.updateOne(
        { _id: id },
        {
          $set: {
            alertStatus: status,
            alertLeaseUntil: null,
            alertedAt: now,
            alertRecipientCount: recipientCount,
            alertNextAttemptAt: status === "failed" ? new Date(now.getTime() + retryDelayMs(attempt)) : null,
          },
        },
      );
      return { processed: true, recipients: recipientCount, status };
    } catch (e) {
      // Ids and error class only — never question text or provider payloads.
      console.error("[medical-qa-alerts] processing failed", { questionId: String(id), error: (e as Error)?.name });
      await MedicalQuestionModel.updateOne(
        { _id: id },
        {
          $set: {
            alertStatus: "failed",
            alertLeaseUntil: null,
            alertNextAttemptAt: new Date(now.getTime() + retryDelayMs(attempt)),
          },
        },
      ).catch(() => undefined);
      return { processed: true, recipients: 0, status: "failed" };
    }
  },

  /** Retries due alert runs (failed, or stuck past their lease) for recent questions. Returns how many ran. */
  async sweepPending(opts: { now?: Date; limit?: number } = {}): Promise<number> {
    const now = opts.now ?? new Date();
    await connectDatabase();
    const due = await MedicalQuestionModel.find({
      alertStatus: { $in: ["failed", "processing"] },
      alertAttempts: { $lt: CFG.maxAttempts },
      createdAt: { $gte: new Date(now.getTime() - CFG.retryWindowMs) },
      deletedAt: null,
      moderationStatus: "visible",
      $and: [
        { $or: [{ alertLeaseUntil: null }, { alertLeaseUntil: { $lte: now } }] },
        { $or: [{ alertNextAttemptAt: null }, { alertNextAttemptAt: { $lte: now } }] },
      ],
    })
      .sort({ alertNextAttemptAt: 1 })
      .limit(opts.limit ?? 20)
      .select("_id")
      .lean();
    let ran = 0;
    for (const q of due) {
      const r = await this.processQuestion(String(q._id), { now });
      if (r.processed) ran += 1;
    }
    return ran;
  },

  async getPreference(userId: string): Promise<boolean> {
    await connectDatabase();
    const pref = await MedicalQaAlertPreferenceModel.findOne({ userId: new Types.ObjectId(userId) })
      .select("questionAlerts")
      .lean();
    return pref?.questionAlerts ?? true;
  },

  async setPreference(userId: string, questionAlerts: boolean): Promise<boolean> {
    await connectDatabase();
    await MedicalQaAlertPreferenceModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $set: { questionAlerts } },
      { upsert: true },
    );
    return questionAlerts;
  },

  /** The session user's own setting, and whether they can receive these alerts at all. */
  async preferenceView(userId: string) {
    const [questionAlerts, role] = await Promise.all([this.getPreference(userId), resolveProviderRole(userId)]);
    return { questionAlerts, eligible: role !== null };
  },
};
