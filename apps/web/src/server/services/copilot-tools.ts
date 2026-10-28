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
import {
  describeSlotPreference,
  filterSlotsByPreference,
  pickPreferredSlot,
  SLOT_PREFERENCE_TOOL_PROPERTIES,
  slotPreferenceFromToolArgs,
  type ConsultSlot,
  type SlotPreference,
} from "@/server/services/copilot-slot-match";

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

type ConsultDoctor = Awaited<ReturnType<typeof OnlineConsultService.listConsultDoctors>>[number];

async function resolveDoctorsForRequest(
  /** Online consults are nationwide — pass a city only to narrow results. */
  city: string | undefined,
  resolvedSpecialty?: string,
  doctorName?: string,
  doctorId?: string,
): Promise<ConsultDoctor[]> {
  let doctors: ConsultDoctor[];

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

  return doctors.filter((d) => !d.isFull);
}

async function findDoctorsWithMatchingSlots(
  city: string | undefined,
  preference: SlotPreference,
  resolvedSpecialty?: string,
  doctorName?: string,
  doctorId?: string,
  limit = 5,
): Promise<
  Array<{
    doctor: ConsultDoctor;
    slot: ConsultSlot;
    matchedPreference: boolean;
  }>
> {
  const doctors = await resolveDoctorsForRequest(
    city,
    resolvedSpecialty,
    doctorName,
    doctorId,
  );
  const matches: Array<{
    doctor: ConsultDoctor;
    slot: ConsultSlot;
    matchedPreference: boolean;
  }> = [];

  const candidates = doctors
    .slice(0, 12)
    .filter(
      (doctor) =>
        !resolvedSpecialty ||
        doctorId ||
        doctorName ||
        matchDoctorSpecialty(doctor.specialties, resolvedSpecialty),
    );

  // Read-only slot lookups, a few at a time; batches keep the original doctor order.
  const SLOT_LOOKUP_CONCURRENCY = 4;
  for (let i = 0; i < candidates.length && matches.length < limit; i += SLOT_LOOKUP_CONCURRENCY) {
    const batch = candidates.slice(i, i + SLOT_LOOKUP_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((doctor) => OnlineConsultService.getSlotsForDoctor(doctor.doctorId)),
    );

    for (const [index, doctor] of batch.entries()) {
      if (matches.length >= limit) break;
      const result = results[index];
      // Only surface failures for doctors the sequential scan would have reached.
      if (result.status === "rejected") throw result.reason;
      const available = result.value.slots.filter((s) => s.status === SlotStatuses.AVAILABLE);
      if (!available.length) continue;

      const strict = filterSlotsByPreference(available, preference);
      const slot = strict[0] ?? pickPreferredSlot(available, preference);
      if (!slot) continue;

      matches.push({
        doctor,
        slot,
        matchedPreference: strict.length > 0,
      });
    }
  }

  return matches;
}

async function findBestSlot(
  city: string | undefined,
  specialtyHint?: string,
  preference: SlotPreference = {},
  doctorName?: string,
  doctorId?: string,
): Promise<{
  doctor: ConsultDoctor;
  slot: ConsultSlot;
  matchedPreference: boolean;
} | null> {
  const resolvedSpecialty = specialtyHint
    ? resolveSpecialtyFromText(specialtyHint) ?? specialtyHint
    : undefined;

  const matches = await findDoctorsWithMatchingSlots(
    city,
    preference,
    resolvedSpecialty,
    doctorName,
    doctorId,
    1,
  );

  return matches[0] ?? null;
}

function doctorToReferral(doctor: ConsultDoctor): DoctorReferralPayload {
  return {
    doctorId: doctor.doctorId,
    slug: doctor.slug,
    name: doctor.name,
    avatarUrl: doctor.avatarUrl,
    specialties: doctor.specialties,
    consultationFee: doctor.consultationFee,
    availableSlots: doctor.availableSlots,
    pmdcVerified: doctor.pmdcVerified,
    ratingAvg: doctor.ratingAvg,
    ratingCount: doctor.ratingCount,
  };
}

const SLOT_TOOL_PROPERTIES = {
  ...SLOT_PREFERENCE_TOOL_PROPERTIES,
} as const;

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
        "Find and show doctors matching specialty AND time preferences (next hour, tomorrow morning/evening, highest-rated). Use for 'find me a skin specialist within the next hour'. Doctors are sorted by rating. Never say you cannot filter — pass the time/rating parameters.",
      parameters: {
        type: "object",
        properties: {
          specialty: {
            type: "string",
            description:
              "Specialty or problem in Urdu/English e.g. Dermatologist, skin specialist, Cardiologist, General Physician, jild, dl, dil",
          },
          reason: { type: "string", description: "Why these doctors are recommended" },
          ...SLOT_TOOL_PROPERTIES,
        },
        required: ["specialty"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_doctors",
      description: "Search available ZindagiCare doctors for online video consultation in Pakistan.",
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
        "Book a video consultation and start checkout. Supports specialty, highest-rated doctor, and time filters (next hour, tomorrow morning/evening, kal subah). Always call this when patient asks to book — never say you cannot filter by rating or time.",
      parameters: {
        type: "object",
        properties: {
          specialty: {
            type: "string",
            description:
              "Required when booking by type: Cardiologist, Dermatologist, General Physician, skin specialist, etc.",
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
          ...SLOT_TOOL_PROPERTIES,
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
      const preference = slotPreferenceFromToolArgs(args);
      const matches = await findDoctorsWithMatchingSlots(
        undefined,
        preference,
        resolved,
        undefined,
        undefined,
        5,
      );

      let referrals: DoctorReferralPayload[] = matches.map((match) =>
        doctorToReferral(match.doctor),
      );

      if (!referrals.length) {
        const doctors = await resolveDoctorsForRequest(undefined, resolved);
        referrals = doctors.slice(0, 5).map(doctorToReferral);
      }

      state.doctorReferrals = referrals;
      state.triageLevel = state.triageLevel ?? "book_consult";

      const topMatch = matches[0];
      if (topMatch) {
        state.bookingSuggestion = {
          doctorId: topMatch.doctor.doctorId,
          doctorSlug: topMatch.doctor.slug,
          doctorName: topMatch.doctor.name,
          doctorAvatarUrl: topMatch.doctor.avatarUrl,
          specialty: topMatch.doctor.specialties[0] ?? resolved,
          consultationFee: topMatch.doctor.consultationFee,
          slotId: topMatch.slot.slotId,
          slotStartAt: topMatch.slot.startAt,
          slotEndAt: topMatch.slot.endAt,
          pmdcVerified: topMatch.doctor.pmdcVerified,
          ratingAvg: topMatch.doctor.ratingAvg,
          ratingCount: topMatch.doctor.ratingCount,
        };
      }

      return JSON.stringify({
        ok: true,
        specialty: resolved,
        reason: args.reason,
        preference: describeSlotPreference(preference),
        matchedExactPreference: matches.some((match) => match.matchedPreference),
        doctors: referrals,
        suggestedSlot: topMatch
          ? {
              doctorName: topMatch.doctor.name,
              startAt: topMatch.slot.startAt,
              ratingAvg: topMatch.doctor.ratingAvg,
            }
          : null,
      });
    }

    case "search_doctors": {
      const specialtyRaw = typeof args.specialty === "string" ? args.specialty : undefined;
      const specialty = specialtyRaw
        ? resolveSpecialtyFromText(specialtyRaw) ?? specialtyRaw
        : undefined;
      const doctors = await OnlineConsultService.listConsultDoctors(undefined, specialty);
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
      const doctors = await OnlineConsultService.listConsultDoctors();
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
        doctorId = await CopilotPatientDataService.resolveDoctorIdByName(undefined, doctorName);
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

      const preference = slotPreferenceFromToolArgs(args);
      const match = await findBestSlot(
        undefined,
        resolvedSpecialty ?? resolveSpecialtyFromText(patientNotes),
        preference,
        doctorName,
        doctorId,
      );

      if (!match) {
        if (resolvedSpecialty || doctorName) {
          const referrals = await executeCopilotTool(
            "refer_doctors",
            JSON.stringify({
              specialty: resolvedSpecialty ?? specialtyInput ?? doctorName,
              ...args,
            }),
            ctx,
            state,
          );
          return JSON.stringify({
            error: "no_slots",
            message: `No slots for ${describeSlotPreference(preference)}. Showing available doctors instead.`,
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
