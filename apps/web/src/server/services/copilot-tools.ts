import { SlotStatuses } from "@zindagi/shared";
import type {
  BookedAppointmentPayload,
  BookingSuggestionPayload,
  DoctorReferralPayload,
} from "@zindagi/validators";
import type { LlmTool } from "@/server/services/gemini.service";
import {
  matchDoctorSpecialty,
  resolveSpecialtyFromText,
} from "@/server/services/copilot-specialty-map";
import { OnlineConsultService } from "@/server/services/online-consult.service";
import { CopilotPatientDataService } from "@/server/services/copilot-patient-data.service";
import { isDummyPaymentMode } from "@/lib/payments/dummy-payment";
import { siteConfig } from "@/config/site";
import {
  isAllowedCopilotTool,
  sanitizeToolArguments,
} from "@/lib/copilot/security";

export type CopilotToolContext = {
  userId: string;
  city: string;
  locale: "en" | "ur";
};

export type CopilotToolState = {
  triageLevel?: "self_care" | "book_consult" | "urgent" | "emergency";
  bookingSuggestion?: BookingSuggestionPayload;
  doctorReferrals?: DoctorReferralPayload[];
  bookedAppointment?: BookedAppointmentPayload;
  urgentCareSuggestion?: { href: string; prefillNotes?: string };
  actionLinks?: Array<{ label: string; href: string }>;
  appointmentPreviews?: Array<{
    appointmentId: string;
    doctorName: string;
    specialty: string;
    scheduledStart: string;
    status: string;
    href: string;
  }>;
  prescriptionPreviews?: Array<{
    prescriptionId: string;
    doctorName: string;
    createdAt: string;
    href: string;
  }>;
};

const KARACHI_TZ = "Asia/Karachi";

function isSlotToday(iso: string): boolean {
  const slotDate = new Date(iso).toLocaleDateString("en-CA", { timeZone: KARACHI_TZ });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: KARACHI_TZ });
  return slotDate === today;
}

async function findBestSlot(
  city: string,
  specialtyHint?: string,
  preferToday = true,
  doctorName?: string,
  doctorId?: string,
): Promise<{
  doctor: Awaited<ReturnType<typeof OnlineConsultService.listConsultDoctors>>[number];
  slot: { slotId: string; startAt: string; endAt: string };
} | null> {
  const resolvedSpecialty = specialtyHint
    ? resolveSpecialtyFromText(specialtyHint) ?? specialtyHint
    : undefined;

  let doctors: Awaited<ReturnType<typeof OnlineConsultService.listConsultDoctors>>;

  if (doctorId) {
    doctors = (await OnlineConsultService.listConsultDoctors(city)).filter(
      (d) => d.doctorId === doctorId,
    );
  } else if (doctorName?.trim()) {
    const query = doctorName.trim().toLowerCase().replace(/^dr\.?\s*/i, "");
    doctors = (await OnlineConsultService.listConsultDoctors(city)).filter((d) => {
      const name = d.name.toLowerCase();
      return (
        name.includes(query) ||
        query.split(/\s+/).filter(Boolean).every((part) => name.includes(part))
      );
    });
  } else if (resolvedSpecialty) {
    doctors = await OnlineConsultService.listConsultDoctors(city, resolvedSpecialty);
    if (!doctors.length) {
      doctors = await OnlineConsultService.listConsultDoctors(city);
    }
  } else {
    doctors = await OnlineConsultService.listConsultDoctors(city);
  }

  doctors = doctors.filter((d) => !d.isFull);

  for (const doctor of doctors.slice(0, 8)) {
    if (
      resolvedSpecialty &&
      !doctorId &&
      !doctorName &&
      !matchDoctorSpecialty(doctor.specialties, resolvedSpecialty)
    ) {
      continue;
    }

    const { slots } = await OnlineConsultService.getSlotsForDoctor(doctor.doctorId);
    const available = slots.filter((s) => s.status === SlotStatuses.AVAILABLE);
    if (!available.length) continue;

    const todaySlots = preferToday ? available.filter((s) => isSlotToday(s.startAt)) : [];
    const pick = todaySlots[0] ?? available[0];
    if (pick) return { doctor, slot: pick };
  }

  return null;
}

export const COPILOT_TOOLS: LlmTool[] = [
  {
    type: "function",
    function: {
      name: "assess_symptoms",
      description:
        "Record structured symptom assessment and triage level after gathering enough detail from the patient.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Brief summary of reported symptoms" },
          triageLevel: {
            type: "string",
            enum: ["self_care", "book_consult", "urgent", "emergency"],
          },
          redFlags: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "triageLevel"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "refer_doctors",
      description:
        "Show a list of available doctors for a medical specialty. Use when patient asks for doctor referral (e.g. skin/dermatology, heart, fever). Understand Roman Urdu: dl=jild=skin=Dermatologist.",
      parameters: {
        type: "object",
        properties: {
          specialty: {
            type: "string",
            description:
              "Specialty or problem in Urdu/English e.g. Dermatologist, skin, jild, dl, General Physician, bukhar",
          },
          reason: { type: "string", description: "Why these doctors are recommended" },
        },
        required: ["specialty"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_doctors",
      description: "Search available ZindagiCare doctors for online video consultation in Lahore.",
      parameters: {
        type: "object",
        properties: {
          specialty: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_doctor_slots",
      description: "Get the next available appointment slots for a specific doctor.",
      parameters: {
        type: "object",
        properties: {
          doctorId: { type: "string" },
        },
        required: ["doctorId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_booking",
      description:
        "Show a booking card when patient should confirm payment themselves. Prefer book_appointment when patient explicitly asked to book.",
      parameters: {
        type: "object",
        properties: {
          doctorId: { type: "string" },
          slotId: { type: "string" },
          patientNotes: { type: "string" },
        },
        required: ["doctorId", "slotId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Reserve a video consultation slot and start checkout. Payment must be completed before the appointment is confirmed. Use when patient asks to book (appointment book kro). Pass specialty for 'cardiologist', 'skin doctor', etc. Pass doctorName for a named doctor. Picks earliest slot.",
      parameters: {
        type: "object",
        properties: {
          specialty: {
            type: "string",
            description:
              "Required when booking by type: Cardiologist, Dermatologist, General Physician, etc.",
          },
          patientNotes: {
            type: "string",
            description: "Symptoms or reason for visit. Optional if specialty or doctor is given.",
          },
          doctorName: {
            type: "string",
            description: "Specific doctor name e.g. Dr Sharma",
          },
          doctorId: {
            type: "string",
            description: "Doctor ID from refer_doctors",
          },
          preferToday: {
            type: "boolean",
            description: "Prefer today's earliest slot (default true)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_urgent_care",
      description: "Suggest urgent care when symptoms need same-day attention but are not ER emergencies.",
      parameters: {
        type: "object",
        properties: {
          prefillNotes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_sunday_consult",
      description: "Free Sunday video consult (Rs. 0). Use when patient asks about free consult or Sunday doctor.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_home_care",
      description:
        "Home visit services (nurse, physiotherapy, IV, injections). Use when patient wants care at home.",
      parameters: {
        type: "object",
        properties: {
          serviceHint: {
            type: "string",
            description: "e.g. nurse, physiotherapy, IV drip, injection",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_appointments",
      description: "List patient's upcoming confirmed/pending video appointments on ZindagiCare.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_prescriptions",
      description: "List patient's recent digital prescriptions from ZindagiCare doctors.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_patient_health_summary",
      description:
        "Get patient's saved allergies, chronic conditions, city — only for the logged-in patient.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_service_links",
      description:
        "Return links for platform services: browse doctors, urgent care, Sunday free consult, home care, dashboard, messages.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Optional: doctors, urgent, sunday, home, dashboard, messages, prescriptions",
          },
        },
      },
    },
  },
];

export async function executeCopilotTool(
  name: string,
  argsJson: string,
  ctx: CopilotToolContext,
  state: CopilotToolState,
): Promise<string> {
  if (!isAllowedCopilotTool(name)) {
    return JSON.stringify({ error: "forbidden_tool" });
  }

  let args: Record<string, unknown> = {};
  try {
    args = sanitizeToolArguments(name, JSON.parse(argsJson) as Record<string, unknown>);
  } catch {
    return JSON.stringify({ error: "Invalid tool arguments" });
  }

  switch (name) {
    case "assess_symptoms": {
      const triageLevel = args.triageLevel as CopilotToolState["triageLevel"];
      if (triageLevel) state.triageLevel = triageLevel;
      return JSON.stringify({
        ok: true,
        summary: args.summary,
        triageLevel,
        redFlags: args.redFlags ?? [],
      });
    }

    case "refer_doctors": {
      const specialtyInput = String(args.specialty ?? "");
      const resolved = resolveSpecialtyFromText(specialtyInput) ?? specialtyInput;
      let doctors = await OnlineConsultService.listConsultDoctors(ctx.city, resolved);
      doctors = doctors.filter((d) => !d.isFull);

      if (!doctors.length) {
        doctors = (await OnlineConsultService.listConsultDoctors(ctx.city)).filter((d) => !d.isFull);
      }

      const referrals: DoctorReferralPayload[] = doctors.slice(0, 5).map((d) => ({
        doctorId: d.doctorId,
        slug: d.slug,
        name: d.name,
        avatarUrl: d.avatarUrl,
        specialties: d.specialties,
        consultationFee: d.consultationFee,
        availableSlots: d.availableSlots,
        pmdcVerified: d.pmdcVerified,
        ratingAvg: d.ratingAvg,
        ratingCount: d.ratingCount,
      }));

      state.doctorReferrals = referrals;
      state.triageLevel = state.triageLevel ?? "book_consult";

      return JSON.stringify({
        ok: true,
        specialty: resolved,
        reason: args.reason,
        doctors: referrals,
      });
    }

    case "search_doctors": {
      const specialtyRaw = typeof args.specialty === "string" ? args.specialty : undefined;
      const specialty = specialtyRaw
        ? resolveSpecialtyFromText(specialtyRaw) ?? specialtyRaw
        : undefined;
      const doctors = await OnlineConsultService.listConsultDoctors(ctx.city, specialty);
      const available = doctors.filter((d) => !d.isFull).slice(0, 8);
      return JSON.stringify({
        doctors: available.map((d) => ({
          doctorId: d.doctorId,
          name: d.name,
          specialties: d.specialties,
          consultationFee: d.consultationFee,
          availableSlots: d.availableSlots,
          pmdcVerified: d.pmdcVerified,
          ratingAvg: d.ratingAvg,
        })),
      });
    }

    case "get_doctor_slots": {
      const doctorId = String(args.doctorId ?? "");
      const { slots } = await OnlineConsultService.getSlotsForDoctor(doctorId);
      const available = slots
        .filter((s) => s.status === SlotStatuses.AVAILABLE)
        .slice(0, 12);
      return JSON.stringify({ doctorId, slots: available });
    }

    case "suggest_booking": {
      const doctorId = String(args.doctorId ?? "");
      const slotId = String(args.slotId ?? "");
      const doctors = await OnlineConsultService.listConsultDoctors(ctx.city);
      const doctor = doctors.find((d) => d.doctorId === doctorId);
      if (!doctor) {
        return JSON.stringify({ error: "Doctor not found" });
      }

      const { slots } = await OnlineConsultService.getSlotsForDoctor(doctorId);
      const slot = slots.find((s) => s.slotId === slotId);
      if (!slot || slot.status !== SlotStatuses.AVAILABLE) {
        return JSON.stringify({ error: "Slot not available" });
      }

      state.triageLevel = state.triageLevel ?? "book_consult";
      state.bookingSuggestion = {
        doctorId,
        doctorSlug: doctor.slug,
        doctorName: doctor.name,
        doctorAvatarUrl: doctor.avatarUrl,
        specialty: doctor.specialties[0] ?? "General Physician",
        consultationFee: doctor.consultationFee,
        slotId: slot.slotId,
        slotStartAt: slot.startAt,
        slotEndAt: slot.endAt,
        pmdcVerified: doctor.pmdcVerified,
        ratingAvg: doctor.ratingAvg,
        ratingCount: doctor.ratingCount,
      };

      return JSON.stringify({
        ok: true,
        bookingSuggestion: state.bookingSuggestion,
        patientNotes: args.patientNotes ?? "",
      });
    }

    case "book_appointment": {
      const doctorName =
        typeof args.doctorName === "string" ? args.doctorName.trim() : undefined;
      let doctorId = typeof args.doctorId === "string" ? args.doctorId.trim() : undefined;
      const specialtyInput =
        typeof args.specialty === "string" ? args.specialty.trim() : "";
      const resolvedSpecialty = specialtyInput
        ? resolveSpecialtyFromText(specialtyInput) ?? specialtyInput
        : undefined;

      let patientNotes = String(args.patientNotes ?? "").trim();

      if (!doctorId && doctorName) {
        doctorId = await CopilotPatientDataService.resolveDoctorIdByName(ctx.city, doctorName);
      }

      if (!patientNotes) {
        if (doctorName) {
          patientNotes = `Consultation with ${doctorName} — requested via health assistant`;
        } else if (resolvedSpecialty) {
          patientNotes = `${resolvedSpecialty} consultation — requested via health assistant`;
        } else {
          patientNotes = "General consultation — requested via health assistant";
        }
      }

      const preferToday = args.preferToday !== false;
      const match = await findBestSlot(
        ctx.city,
        resolvedSpecialty ?? resolveSpecialtyFromText(patientNotes),
        preferToday,
        doctorName,
        doctorId,
      );

      if (!match) {
        if (resolvedSpecialty || doctorName) {
          const referrals = await executeCopilotTool(
            "refer_doctors",
            JSON.stringify({ specialty: resolvedSpecialty ?? specialtyInput ?? doctorName }),
            ctx,
            state,
          );
          return JSON.stringify({
            error: "no_slots",
            message: "No slots available right now. Showing available doctors instead.",
            referDoctorsResult: JSON.parse(referrals),
          });
        }
        return JSON.stringify({
          error: "no_slots",
          message: "No available appointment slots found.",
        });
      }

      const { doctor, slot } = match;

      const checkout = await OnlineConsultService.initiateCheckout(ctx.userId, {
        doctorId: doctor.doctorId,
        slotId: slot.slotId,
        patientNotes,
        locale: ctx.locale,
      });

      state.bookingSuggestion = {
        doctorId: doctor.doctorId,
        doctorSlug: doctor.slug,
        doctorName: doctor.name,
        doctorAvatarUrl: doctor.avatarUrl,
        specialty: doctor.specialties[0] ?? "General Physician",
        consultationFee: doctor.consultationFee,
        slotId: slot.slotId,
        slotStartAt: slot.startAt,
        slotEndAt: slot.endAt,
        pmdcVerified: doctor.pmdcVerified,
        ratingAvg: doctor.ratingAvg,
        ratingCount: doctor.ratingCount,
      };
      state.bookedAppointment = {
        appointmentId: checkout.appointmentId,
        doctorName: doctor.name,
        specialty: doctor.specialties[0] ?? "General Physician",
        scheduledStart: slot.startAt,
        scheduledEnd: slot.endAt,
        consultationFee: doctor.consultationFee,
        status: "pending_payment",
        paymentId: checkout.paymentId,
        dashboardHref: "/dashboard",
      };
      state.triageLevel = "book_consult";

      return JSON.stringify({
        ok: true,
        booked: false,
        requiresPayment: true,
        paymentId: checkout.paymentId,
        bookedAppointment: state.bookedAppointment,
        bookingSuggestion: state.bookingSuggestion,
      });
    }

    case "suggest_urgent_care": {
      const prefillNotes =
        typeof args.prefillNotes === "string" ? args.prefillNotes : undefined;
      state.triageLevel = "urgent";
      state.urgentCareSuggestion = {
        href: siteConfig.links.urgentCare,
        prefillNotes,
      };
      state.actionLinks = [
        { label: ctx.locale === "ur" ? "فوری دیکھ بھال" : "Urgent care", href: siteConfig.links.urgentCare },
      ];
      return JSON.stringify({ ok: true, urgentCareSuggestion: state.urgentCareSuggestion });
    }

    case "suggest_sunday_consult": {
      state.actionLinks = [
        {
          label: ctx.locale === "ur" ? "اتوار مفت مشاورت" : "Sunday free consult",
          href: siteConfig.links.sundayConsult,
        },
      ];
      return JSON.stringify({
        ok: true,
        href: siteConfig.links.sundayConsult,
        message: "Free 10-minute Sunday video consult",
      });
    }

    case "suggest_home_care": {
      const hint = typeof args.serviceHint === "string" ? args.serviceHint.toLowerCase() : "";
      const href = hint.includes("physio")
        ? siteConfig.links.homePhysiotherapy
        : siteConfig.links.homeCareRequest;
      state.actionLinks = [
        {
          label: ctx.locale === "ur" ? "گھر پر سہولت" : "Home care request",
          href,
        },
      ];
      return JSON.stringify({ ok: true, href });
    }

    case "list_my_appointments": {
      const appointments = await CopilotPatientDataService.listUpcomingAppointments(ctx.userId);
      state.appointmentPreviews = appointments;
      return JSON.stringify({ ok: true, appointments });
    }

    case "list_my_prescriptions": {
      const prescriptions = await CopilotPatientDataService.listPrescriptionPreviews(ctx.userId);
      state.prescriptionPreviews = prescriptions;
      return JSON.stringify({ ok: true, prescriptions });
    }

    case "get_patient_health_summary": {
      const summary = await CopilotPatientDataService.getHealthSummary(ctx.userId);
      return JSON.stringify({ ok: true, summary });
    }

    case "get_service_links": {
      const topic = typeof args.topic === "string" ? args.topic.toLowerCase() : "all";
      const allLinks = [
        { label: "Browse doctors", href: siteConfig.links.doctors },
        { label: "Urgent care", href: siteConfig.links.urgentCare },
        { label: "Sunday free consult", href: siteConfig.links.sundayConsult },
        { label: "Home services", href: siteConfig.links.homeServices },
        { label: "Dashboard", href: siteConfig.links.dashboard },
        { label: "Messages", href: siteConfig.links.messages },
      ];
      const filtered =
        topic === "all"
          ? allLinks
          : allLinks.filter((link) => link.href.includes(topic) || link.label.toLowerCase().includes(topic));
      state.actionLinks = filtered;
      return JSON.stringify({ ok: true, links: filtered });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export function isDummyPaymentsEnabled(): boolean {
  return isDummyPaymentMode();
}
