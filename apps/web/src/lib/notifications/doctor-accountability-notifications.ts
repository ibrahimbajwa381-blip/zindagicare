import { connectDatabase, NotificationModel } from "@zindagi/database";
import { NotificationChannels } from "@zindagi/shared";

type NotifyPayload = {
  userId: string;
  title: string;
  body: string;
  phone?: string;
  payload: Record<string, unknown>;
};

async function persist(input: NotifyPayload) {
  await connectDatabase();

  await NotificationModel.create({
    userId: input.userId,
    channel: NotificationChannels.IN_APP,
    title: input.title,
    body: input.body,
    payload: input.payload,
    sentAt: new Date(),
  });

  if (input.phone && process.env.SMS_API_KEY) {
    console.info("[SMS]", input.phone, input.body);
  }
  if (input.phone && process.env.WHATSAPP_API_KEY) {
    console.info("[WhatsApp]", input.phone, input.body);
  }
}

/** Warning sent to a doctor when they reach the monthly miss warning threshold. */
export async function sendDoctorMissWarning(params: {
  doctorUserId: string;
  phone?: string;
  missCount: number;
  removalThreshold: number;
  monthLabel: string;
}) {
  const remaining = Math.max(params.removalThreshold - params.missCount, 1);
  await persist({
    userId: params.doctorUserId,
    phone: params.phone,
    title: "Warning: missed consultations",
    body: `You have missed ${params.missCount} consultations in ${params.monthLabel}. This is a formal warning. Missing ${remaining} more this month will remove you from ZindagiCare. Please ensure you join your appointments on time.`,
    payload: {
      type: "doctor_miss_warning",
      missCount: params.missCount,
      removalThreshold: params.removalThreshold,
    },
  });
}

/** Notice sent to a doctor when they are automatically removed/restricted. */
export async function sendDoctorRemovalNotice(params: {
  doctorUserId: string;
  phone?: string;
  missCount: number;
  monthLabel: string;
}) {
  await persist({
    userId: params.doctorUserId,
    phone: params.phone,
    title: "Account restricted: missed consultations",
    body: `You missed ${params.missCount} consultations in ${params.monthLabel} and have been removed from active consultations. Your listing and bookings are suspended. Please contact the ZindagiCare admin team to restore your account.`,
    payload: {
      type: "doctor_miss_removal",
      missCount: params.missCount,
    },
  });
}

/** Alert sent to each admin when a doctor is auto-removed. */
export async function notifyAdminDoctorRemoved(params: {
  adminUserId: string;
  doctorName: string;
  missCount: number;
  monthLabel: string;
  doctorProfileId: string;
}) {
  await persist({
    userId: params.adminUserId,
    title: "Doctor auto-restricted for missed consults",
    body: `Dr. ${params.doctorName} was automatically restricted after ${params.missCount} missed consultations in ${params.monthLabel}.`,
    payload: {
      type: "admin_doctor_auto_restricted",
      doctorProfileId: params.doctorProfileId,
      missCount: params.missCount,
    },
  });
}

/** Notify the patient that the doctor did not attend their consultation. */
export async function notifyPatientDoctorMissed(params: {
  patientUserId: string;
  phone?: string;
  appointmentId: string;
}) {
  await persist({
    userId: params.patientUserId,
    phone: params.phone,
    title: "Doctor did not attend",
    body: "We're sorry — the doctor did not attend your scheduled consultation. Please rebook, and contact support if you paid for this consult.",
    payload: {
      type: "patient_doctor_missed",
      appointmentId: params.appointmentId,
    },
  });
}
