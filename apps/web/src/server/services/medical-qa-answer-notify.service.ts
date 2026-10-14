import { Types } from "mongoose";
import {
  connectDatabase,
  MedicalAnswerModel,
  MedicalQuestionModel,
  NotificationModel,
  UserModel,
} from "@zindagi/database";
import { NotificationChannels } from "@zindagi/shared";
import { objectIdSchema } from "@zindagi/validators";
import { isQuietHours, questionPreview } from "@/server/lib/medical-qa-alert-rules";
import { sendExpoPushToUser, sendWebPushToUser } from "@/server/services/push.service";

/**
 * Tells a question's author that a professional answered it: an in-app
 * notification (the header bell) plus a push to their devices.
 *
 * Privacy: the text names only the answerer's role and the (public) question
 * title — never the answer text, which could show on a lock screen.
 * Exactly once per answer: the notification reuses the answer's _id.
 */
export const ANSWER_NOTIFY_CONFIG = {
  /** At most one push per question per this window (from the last push sent); every answer still lands in the bell. */
  pushPerQuestionWindowMs: 10 * 60 * 1000,
  pushTimeoutMs: 10_000,
} as const;

const ROLE_LABELS: Record<string, string> = {
  doctor: "A doctor",
  nurse: "A nurse",
  physiotherapist: "A physiotherapist",
};

export type AnswerNotificationContent = {
  title: string;
  body: string;
  url: string;
  payload: { type: "medical_question_answered"; questionId: string; answerId: string; url: string };
};

export function buildAnswerNotificationContent(input: {
  questionId: string;
  answerId: string;
  questionTitle: string;
  answererRole: string;
}): AnswerNotificationContent {
  const url = `/questions/${input.questionId}`;
  // Own-property check: "constructor"/"__proto__" can never resolve to a label.
  const who = Object.hasOwn(ROLE_LABELS, input.answererRole) ? ROLE_LABELS[input.answererRole] : "A professional";
  const preview = questionPreview(input.questionTitle);
  return {
    title: "Your question has an answer",
    body: preview ? `${who} answered "${preview}" — tap to read it.` : `${who} answered your question — tap to read it.`,
    url,
    payload: { type: "medical_question_answered", questionId: input.questionId, answerId: input.answerId, url },
  };
}

type PushResult = "sent" | "no_device" | "failed" | "skipped_quiet_hours" | "skipped_recent";
export type AnswerNotifyResult = { notified: false; reason: string } | { notified: true; push: PushResult };

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

async function push(userId: string, content: AnswerNotificationContent, questionId: string, timeoutMs: number) {
  const [expo, web] = await Promise.allSettled([
    // Started inside a promise so a provider that throws synchronously is a rejection, not a crash.
    withTimeout(
      Promise.resolve().then(() =>
        sendExpoPushToUser(userId, { title: content.title, body: content.body, data: content.payload }),
      ),
      timeoutMs,
    ),
    withTimeout(
      Promise.resolve().then(() =>
        sendWebPushToUser(userId, { title: content.title, body: content.body, url: content.url, tag: `mqa-answer-${questionId}` }),
      ),
      timeoutMs,
    ),
  ]);
  let sent = 0;
  let failed = 0;
  for (const r of [expo, web]) {
    if (r.status === "fulfilled") {
      sent += r.value.sent;
      failed += r.value.failed;
    } else {
      failed += 1;
    }
  }
  if (sent > 0) return "sent" as const;
  return failed > 0 ? ("failed" as const) : ("no_device" as const);
}

/**
 * Atomic, cross-instance claim of the question's push slot: true for exactly
 * one caller per window, measured from the last push actually sent.
 */
async function claimPushSlot(questionId: Types.ObjectId, now: Date): Promise<boolean> {
  const windowStart = new Date(now.getTime() - ANSWER_NOTIFY_CONFIG.pushPerQuestionWindowMs);
  const r = await MedicalQuestionModel.updateOne(
    { _id: questionId, $or: [{ answerPushAt: null }, { answerPushAt: { $lte: windowStart } }] },
    { $set: { answerPushAt: now } },
  );
  return r.modifiedCount === 1;
}

async function releasePushSlot(questionId: Types.ObjectId, now: Date) {
  await MedicalQuestionModel.updateOne({ _id: questionId, answerPushAt: now }, { $unset: { answerPushAt: 1 } });
}

export async function notifyQuestionAnswered(
  answerId: string,
  opts: { now?: Date; pushTimeoutMs?: number } = {},
): Promise<AnswerNotifyResult> {
  if (!objectIdSchema.safeParse(answerId).success) return { notified: false, reason: "invalid_id" };
  const now = opts.now ?? new Date();
  await connectDatabase();

  const answer = await MedicalAnswerModel.findOne({
    _id: new Types.ObjectId(answerId),
    kind: "answer",
    deletedAt: null,
    moderationStatus: "visible",
  })
    .select("questionId authorId authorRole")
    .lean();
  if (!answer) return { notified: false, reason: "answer_unavailable" };

  const question = await MedicalQuestionModel.findOne({
    _id: answer.questionId,
    deletedAt: null,
    moderationStatus: "visible",
  })
    .select("authorId title")
    .lean();
  if (!question) return { notified: false, reason: "question_unavailable" };
  if (String(question.authorId) === String(answer.authorId)) return { notified: false, reason: "own_question" };

  const author = await UserModel.findOne({ _id: question.authorId, isActive: { $ne: false }, deletedAt: null })
    .select("_id")
    .lean();
  if (!author) return { notified: false, reason: "author_unavailable" };

  const questionId = String(question._id);
  const userId = String(question.authorId);
  const content = buildAnswerNotificationContent({
    questionId,
    answerId: String(answer._id),
    questionTitle: question.title,
    answererRole: answer.authorRole,
  });

  try {
    await NotificationModel.create({
      _id: answer._id, // one notification per answer, even if this runs twice
      userId: question.authorId,
      channel: NotificationChannels.IN_APP,
      title: content.title,
      body: content.body,
      payload: content.payload,
      sentAt: now,
    });
  } catch (e) {
    if ((e as { code?: number })?.code === 11000) return { notified: false, reason: "already_notified" };
    throw e;
  }

  if (isQuietHours(now)) return { notified: true, push: "skipped_quiet_hours" };
  if (!(await claimPushSlot(question._id, now))) return { notified: true, push: "skipped_recent" };

  const result = await push(userId, content, questionId, opts.pushTimeoutMs ?? ANSWER_NOTIFY_CONFIG.pushTimeoutMs);
  // Nothing reached a device: free the slot so the next answer can try again.
  if (result !== "sent") await releasePushSlot(question._id, now);
  return { notified: true, push: result };
}
