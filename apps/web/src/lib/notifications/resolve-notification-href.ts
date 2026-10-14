import { isAdmin, Roles, type Role } from "@zindagi/shared";

/**
 * Maps in-app notification payloads to workspace routes for deep linking.
 */
export function resolveNotificationHref(
  payload: Record<string, unknown> | undefined,
  roles: Role[] = [],
): string | null {
  if (!payload) return null;

  const type = typeof payload.type === "string" ? payload.type : undefined;
  if (!type) {
    return payload.source === "admin_broadcast" ? null : null;
  }

  const isDoctor = roles.includes(Roles.DOCTOR);
  const isStaffAdmin = isAdmin(roles);
  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : undefined;
  const appointmentId =
    typeof payload.appointmentId === "string" ? payload.appointmentId : undefined;
  const patientId =
    typeof payload.patientId === "string" ? payload.patientId : undefined;

  switch (type) {
    case "urgent_care_assigned":
      if (!isDoctor) return null;
      return appointmentId
        ? `/doctor/urgent-calls?requestId=${encodeURIComponent(requestId ?? appointmentId)}`
        : requestId
          ? `/doctor/urgent-calls?requestId=${encodeURIComponent(requestId)}`
          : "/doctor/urgent-calls";

    case "urgent_care_requested":
      if (!isStaffAdmin) return null;
      return requestId
        ? `/admin/urgent-care?requestId=${encodeURIComponent(requestId)}`
        : "/admin/urgent-care";

    case "sunday_free_requested":
      if (!isStaffAdmin) return null;
      return requestId
        ? `/admin/sunday-consult?requestId=${encodeURIComponent(requestId)}`
        : "/admin/sunday-consult";

    case "sunday_free_open_request":
      return isDoctor ? "/doctor/sunday-consult" : null;

    case "online_consult_requested":
    case "online_consult_paid":
      if (!isStaffAdmin) return null;
      return appointmentId
        ? `/admin/appointments?appointmentId=${encodeURIComponent(appointmentId)}`
        : "/admin/appointments";

    case "doctor_appointment_reminder_start_now": {
      if (!isDoctor) return null;
      if (!appointmentId) return "/doctor/requests";
      // Clinic visits are in-person; online / Sunday Free open Zoom directly.
      const appointmentType =
        typeof payload.appointmentType === "string"
          ? payload.appointmentType
          : undefined;
      if (appointmentType === "clinic") {
        return `/doctor/intake/${encodeURIComponent(appointmentId)}`;
      }
      return `/consult/video/${encodeURIComponent(appointmentId)}`;
    }

    case "doctor_consult_booked":
      if (!isDoctor) return null;
      if (patientId) return `/doctor/messages?patient=${encodeURIComponent(patientId)}`;
      return appointmentId
        ? `/doctor/intake/${encodeURIComponent(appointmentId)}`
        : "/doctor/requests";

    case "doctor_appointment_reminder_24h":
    case "doctor_appointment_reminder_1h":
    case "doctor_appointment_reminder_sunday_morning":
      if (!isDoctor) return null;
      if (patientId) return `/doctor/messages?patient=${encodeURIComponent(patientId)}`;
      return appointmentId
        ? `/doctor/intake/${encodeURIComponent(appointmentId)}`
        : "/doctor/requests";

    case "intake_completed":
      if (!isDoctor) return null;
      return appointmentId
        ? `/doctor/intake/${encodeURIComponent(appointmentId)}`
        : "/doctor/requests";

    case "doctor_miss_warning":
    case "doctor_miss_removal":
      return isDoctor ? "/doctor/profile" : null;

    case "admin_doctor_auto_restricted":
      return isStaffAdmin ? "/admin/doctors" : null;

    case "appointment_reminder_24h":
    case "appointment_reminder_1h":
    case "appointment_reminder_start_now":
    case "appointment_reminder_sunday_morning":
    case "online_consult_confirmed":
    case "urgent_consult_confirmed":
    case "sunday_booking_confirmed":
    case "sunday_free_released":
    case "patient_doctor_missed":
      return "/dashboard";

    case "home_visit_assigned":
      if (roles.includes(Roles.NURSE)) return "/nurse/visits";
      if (roles.includes(Roles.PHYSIOTHERAPIST)) return "/physiotherapist/visits";
      if (isDoctor) return "/doctor/home-visits";
      return null;

    case "home_visit_requested":
      if (!isStaffAdmin) return null;
      return typeof payload.visitId === "string"
        ? `/admin/home-visits?visitId=${encodeURIComponent(payload.visitId)}`
        : "/admin/home-visits";

    case "home_visit_review":
    case "home_visit_status":
      return "/home-care/visits";

    case "prescription_issued":
      return "/prescriptions";

    case "medical_question_new": {
      // The public question page re-checks visibility on every load; the link grants nothing.
      const questionId = payload.questionId;
      return typeof questionId === "string" && /^[a-f0-9]{24}$/i.test(questionId)
        ? `/questions/${questionId}`
        : null;
    }

    default:
      return null;
  }
}
