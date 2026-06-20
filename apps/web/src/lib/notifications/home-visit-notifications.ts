import { connectDatabase, NotificationModel, UserModel } from "@zindagi/database";
import { HomeVisitStatuses, NotificationChannels, Roles } from "@zindagi/shared";
import { formatKarachiDateTime } from "@/lib/format/datetime";

export async function notifyAdminsHomeVisitRequested(input: {
  visitId: string;
  patientName: string;
  serviceLabel: string;
  scheduledAt: Date;
}) {
  await connectDatabase();

  const admins = await UserModel.find({
    roles: { $in: [Roles.ADMIN, Roles.SUPER_ADMIN] },
    isActive: { $ne: false },
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (!admins.length) return;

  const scheduled = formatKarachiDateTime(input.scheduledAt);

  await Promise.all(
    admins.map((admin) =>
      NotificationModel.create({
        userId: admin._id.toString(),
        channel: NotificationChannels.IN_APP,
        title: "New home care request",
        body: `${input.patientName} requested ${input.serviceLabel} — scheduled ${scheduled}. Assign a provider from Home care.`,
        payload: {
          type: "home_visit_requested",
          visitId: input.visitId,
        },
        sentAt: new Date(),
      }),
    ),
  );
}

export async function notifyStaffHomeVisitAssigned(input: {
  staffUserId: string;
  visitId: string;
  serviceLabel: string;
  patientName: string;
  scheduledAt: Date;
}) {
  await NotificationModel.create({
    userId: input.staffUserId,
    channel: NotificationChannels.IN_APP,
    title: "Home visit assigned",
    body: `${input.serviceLabel} for ${input.patientName} — check your visits dashboard.`,
    payload: {
      type: "home_visit_assigned",
      visitId: input.visitId,
    },
  });
}

export async function notifyPatientHomeVisitStatus(input: {
  patientUserId: string;
  visitId: string;
  status: string;
  staffName?: string;
}) {
  const messages: Partial<Record<string, { title: string; body: string }>> = {
    [HomeVisitStatuses.EN_ROUTE]: {
      title: "Provider en route",
      body: `${input.staffName ?? "Your provider"} is on the way to your home.`,
    },
    [HomeVisitStatuses.ARRIVED]: {
      title: "Provider arrived",
      body: `${input.staffName ?? "Your provider"} has arrived for your home visit.`,
    },
    [HomeVisitStatuses.COMPLETED]: {
      title: "Home visit completed",
      body: "How was your in-house care visit? Share your feedback.",
    },
  };

  const copy = messages[input.status];
  if (!copy) return;

  await NotificationModel.create({
    userId: input.patientUserId,
    channel: NotificationChannels.IN_APP,
    title: copy.title,
    body: copy.body,
    payload: {
      type:
        input.status === HomeVisitStatuses.COMPLETED
          ? "home_visit_review"
          : "home_visit_status",
      visitId: input.visitId,
    },
  });
}
