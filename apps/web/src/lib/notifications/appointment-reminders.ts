import { deliverUserNotification } from "@/lib/notifications/deliver-notification";

function formatSlotTime(slotStart: Date) {
  return slotStart.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function consultLabel(type: "online" | "clinic" | "sunday_free") {
  if (type === "sunday_free") return "Sunday Free Consult";
  if (type === "clinic") return "clinic appointment";
  return "online consult";
}

export async function sendAppointmentReminder24h(params: {
  userId: string;
  phone?: string;
  doctorName: string;
  slotStart: Date;
  appointmentId: string;
  type: "online" | "sunday_free";
}) {
  const time = formatSlotTime(params.slotStart);
  const label = consultLabel(params.type);

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Appointment tomorrow",
    body: `Reminder: Your ${label} with Dr. ${params.doctorName} is in 24 hours (${time}).`,
    payload: {
      type: "appointment_reminder_24h",
      appointmentId: params.appointmentId,
    },
  });
}

export async function sendAppointmentReminder1h(params: {
  userId: string;
  phone?: string;
  doctorName: string;
  slotStart: Date;
  appointmentId: string;
  type: "online" | "sunday_free";
}) {
  const time = formatSlotTime(params.slotStart);
  const label = consultLabel(params.type);

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Appointment in 1 hour",
    body: `Your ${label} with Dr. ${params.doctorName} starts at ${time}. Join from your dashboard when it's time.`,
    payload: {
      type: "appointment_reminder_1h",
      appointmentId: params.appointmentId,
    },
  });
}

export async function sendSundayMorningReminder(params: {
  userId: string;
  phone?: string;
  doctorName: string;
  slotStart: Date;
  appointmentId: string;
}) {
  const time = formatSlotTime(params.slotStart);

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Sunday consult today",
    body: `Good morning! Your free consult with Dr. ${params.doctorName} is today at ${time}.`,
    payload: {
      type: "appointment_reminder_sunday_morning",
      appointmentId: params.appointmentId,
    },
  });
}

export async function sendDoctorAppointmentReminder24h(params: {
  userId: string;
  phone?: string;
  patientName: string;
  slotStart: Date;
  appointmentId: string;
  type: "online" | "clinic" | "sunday_free";
}) {
  const time = formatSlotTime(params.slotStart);
  const label = consultLabel(params.type);

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Upcoming appointment tomorrow",
    body: `Reminder: Your ${label} with ${params.patientName} is in 24 hours (${time}).`,
    payload: {
      type: "doctor_appointment_reminder_24h",
      appointmentId: params.appointmentId,
    },
  });
}

export async function sendDoctorAppointmentReminder1h(params: {
  userId: string;
  phone?: string;
  patientName: string;
  slotStart: Date;
  appointmentId: string;
  type: "online" | "clinic" | "sunday_free";
}) {
  const time = formatSlotTime(params.slotStart);
  const label = consultLabel(params.type);

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Appointment in 1 hour",
    body: `Your ${label} with ${params.patientName} starts at ${time}. Open Consult requests to join.`,
    payload: {
      type: "doctor_appointment_reminder_1h",
      appointmentId: params.appointmentId,
    },
  });
}

export async function sendDoctorSundayMorningReminder(params: {
  userId: string;
  phone?: string;
  patientName: string;
  slotStart: Date;
  appointmentId: string;
}) {
  const time = formatSlotTime(params.slotStart);

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Sunday consult today",
    body: `Good morning! Your free consult with ${params.patientName} is today at ${time}.`,
    payload: {
      type: "doctor_appointment_reminder_sunday_morning",
      appointmentId: params.appointmentId,
    },
  });
}

export async function sendAppointmentStartNow(params: {
  userId: string;
  phone?: string;
  doctorName: string;
  appointmentId: string;
  type: "online" | "sunday_free";
}) {
  const label = consultLabel(params.type);

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Consultation starts now",
    body: `Your ${label} with Dr. ${params.doctorName} is starting now. Join from your dashboard.`,
    payload: {
      type: "appointment_reminder_start_now",
      appointmentId: params.appointmentId,
    },
  });
}

export async function sendDoctorAppointmentStartNow(params: {
  userId: string;
  phone?: string;
  patientName: string;
  appointmentId: string;
  type: "online" | "clinic" | "sunday_free";
}) {
  const label = consultLabel(params.type);

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Consultation starts now",
    body: `Your ${label} with ${params.patientName} is starting now. Open Consult requests to join.`,
    payload: {
      type: "doctor_appointment_reminder_start_now",
      appointmentId: params.appointmentId,
    },
  });
}
