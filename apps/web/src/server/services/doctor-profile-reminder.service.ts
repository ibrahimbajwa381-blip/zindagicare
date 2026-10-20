import { createHash } from "node:crypto";
import { connectDatabase, DoctorProfileModel, UserModel } from "@zindagi/database";
import { AppError, VerificationStatuses } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { mongoFilter } from "@/lib/mongo/query";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { doctorCompleteProfileReminderEmail } from "@/server/lib/email-templates";
import { recordAdminActivity } from "@/server/services/admin-activity.service";
import {
  EMAIL_BATCH_LIMIT,
  isEmailConfigured,
  sendEmailBatch,
  type BatchEmailMessage,
} from "@/server/services/email.service";

export type ProfileReminderResult = {
  /** Doctors in the queue who haven't submitted the verification form. */
  incomplete: number;
  sent: number;
  failed: number;
  /** Incomplete doctors with no usable email on file. */
  noEmail: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email every doctor whose application is still incomplete (pending, never
 * submitted), asking them to finish their profile. One private email per
 * doctor — recipients never see each other.
 */
export async function sendIncompleteProfileReminders(
  adminUserId: string,
): Promise<ProfileReminderResult> {
  if (!isEmailConfigured()) {
    throw new AppError("Email sending is not configured", "SERVICE_UNAVAILABLE", 503);
  }

  await connectDatabase();
  const profiles = await DoctorProfileModel.find({
    verificationStatus: VerificationStatuses.PENDING,
    verificationSubmittedAt: { $in: [null] },
  })
    .select("_id userId")
    .lean();

  const userIds = profiles.map((p) => p.userId?.toString()).filter(Boolean) as string[];
  const users = userIds.length
    ? await UserModel.find(mongoFilter({ _id: { $in: userIds } }))
        .select("name email")
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const verificationUrl = `${siteConfig.url.replace(/\/+$/, "")}/login?callbackUrl=${encodeURIComponent("/doctor/verification")}`;
  const support = { email: siteConfig.supportEmail, phone: siteConfig.supportWhatsAppDisplay };

  const recipients: { profileId: string; message: BatchEmailMessage }[] = [];
  const seen = new Set<string>();
  let noEmail = 0;
  for (const profile of profiles) {
    const user = userMap.get(profile.userId?.toString() ?? "");
    const email = safeDisplayText(user?.email)?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      noEmail += 1;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);

    const template = doctorCompleteProfileReminderEmail({
      name: safeDisplayText(user?.name)?.trim() || undefined,
      verificationUrl,
      support,
    });
    recipients.push({
      profileId: profile._id.toString(),
      message: { to: email, subject: template.subject, html: template.html, text: template.text },
    });
  }

  // Same recipients on the same day share a key, so a double-click or retry
  // can't email anyone twice.
  const day = new Date().toISOString().slice(0, 10);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i += EMAIL_BATCH_LIMIT) {
    const chunk = recipients.slice(i, i + EMAIL_BATCH_LIMIT);
    const digest = createHash("sha256")
      .update(chunk.map((r) => r.profileId).sort().join(","))
      .digest("hex")
      .slice(0, 32);
    const result = await sendEmailBatch(
      chunk.map((r) => r.message),
      { idempotencyKey: `doctor-profile-reminder/${day}/${digest}` },
    );
    if (result.ok) sent += chunk.length;
    else failed += chunk.length;
  }

  const outcome: ProfileReminderResult = { incomplete: profiles.length, sent, failed, noEmail };
  console.info(
    `[doctor-profile-reminder] incomplete=${outcome.incomplete} sent=${sent} failed=${failed} no_email=${noEmail}`,
  );

  await recordAdminActivity({
    actor: adminUserId,
    action: "doctor.profile_reminder_sent",
    // Bulk action with no single target profile — anchor the entry on the admin.
    entityType: "User",
    entityId: adminUserId,
    targetLabel: `${sent} incomplete doctor${sent === 1 ? "" : "s"}`,
    changes: outcome,
  });

  return outcome;
}
