import { formatQualificationsList } from "@/lib/doctors/qualifications";
import type { DoctorPortfolioFaq } from "@/lib/doctors/portfolio";
import type { PublicDoctorProfile } from "@/features/marketing/types/doctor-public";

/**
 * Search- and answer-engine copy for public doctor profiles. Everything here is derived
 * from the doctor's verified profile fields, so a page ranks for "Dr <name>", "<name>
 * <specialty> <city>" and answers "where does / how much / how to book" questions even
 * when the doctor hasn't written a bio or FAQs yet.
 */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Meta descriptions over ~155 chars get cut by search engines; end on a whole word. */
export function truncateDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

/** "a, b and c" */
function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function formatFee(fee: number): string {
  return `Rs. ${fee.toLocaleString("en-PK")}`;
}

/** The doctor's name without a leading "Dr." / "Prof." — how many patients search for it. */
export function doctorPlainName(name: string): string {
  return name.replace(/^(dr|prof|professor)\.?\s+/i, "").trim();
}

export function doctorPrimaryCity(doctor: Pick<PublicDoctorProfile, "hospitals">): string | undefined {
  return doctor.hospitals[0]?.city?.trim() || undefined;
}

function doctorSpecialty(doctor: Pick<PublicDoctorProfile, "specialties">): string {
  return doctor.specialties[0] ?? "Specialist";
}

function consultDays(doctor: Pick<PublicDoctorProfile, "weeklyAvailability">): string[] {
  const days = [...new Set(doctor.weeklyAvailability.map((w) => w.dayOfWeek))].sort((a, b) => a - b);
  return days.map((d) => DAY_NAMES[d]).filter(Boolean);
}

/** `<title>` without the site suffix (the root template appends "| ZindagiCare"). */
export function buildDoctorSeoTitle(doctor: PublicDoctorProfile): string {
  const city = doctorPrimaryCity(doctor);
  const specialty = doctorSpecialty(doctor);
  return city
    ? `${doctor.name} — ${specialty} in ${city}`
    : `${doctor.name} — ${specialty} | Online Consult Pakistan`;
}

/**
 * A factual, self-contained paragraph about the doctor. Written in full sentences that
 * repeat the doctor's name so search snippets and AI answers can quote any one of them.
 */
export function buildDoctorSummary(doctor: PublicDoctorProfile): string {
  const { name } = doctor;
  const city = doctorPrimaryCity(doctor);
  const specialties = doctor.specialties.length ? joinList(doctor.specialties) : "doctor";
  const hospitals = doctor.hospitals.slice(0, 3).map((h) => h.name);
  const credentials = formatQualificationsList(doctor.medicalDegree, doctor.qualifications);
  const conditions = doctor.portfolio.conditionsTreated.slice(0, 6);

  const sentences = [
    `${name} is a ${specialties} in ${city ?? "Pakistan"}${
      hospitals.length ? `, practising at ${joinList(hospitals)}` : ""
    }.`,
    credentials.length ? `${name}'s qualifications include ${joinList(credentials)}.` : null,
    doctor.medicalCollege
      ? `${name} graduated from ${doctor.medicalCollege}${
          doctor.graduationYear ? ` in ${doctor.graduationYear}` : ""
        }.`
      : null,
    doctor.experienceYears > 0
      ? `${name} has ${doctor.experienceYears}+ years of clinical experience.`
      : null,
    conditions.length ? `Conditions treated include ${joinList(conditions)}.` : null,
    doctor.pmdcVerified ? `${name}'s PMDC registration is verified by ZindagiCare.` : null,
    `Patients can book ${
      doctor.videoConsultEnabled ? "an online video consultation" : "a consultation"
    } with ${name} on ZindagiCare${
      doctor.consultationFee > 0 ? ` for ${formatFee(doctor.consultationFee)}` : ""
    }.`,
    doctor.ratingCount > 0
      ? `${name} is rated ${doctor.ratingAvg.toFixed(1)}/5 by ${doctor.ratingCount} patient${
          doctor.ratingCount === 1 ? "" : "s"
        } on ZindagiCare.`
      : null,
  ];

  return sentences.filter(Boolean).join(" ");
}

export function buildDoctorMetaDescription(doctor: PublicDoctorProfile): string {
  const authored = [doctor.portfolio.headline?.replace(/[.!?]+$/, ""), doctor.bio]
    .filter(Boolean)
    .join(". ");
  return truncateDescription(authored || buildDoctorSummary(doctor));
}

/** Common patient questions answered from profile data, for doctors without their own FAQs. */
function buildGeneratedDoctorFaqs(doctor: PublicDoctorProfile): DoctorPortfolioFaq[] {
  const { name } = doctor;
  const credentials = formatQualificationsList(doctor.medicalDegree, doctor.qualifications);
  const days = consultDays(doctor);
  const faqs: (DoctorPortfolioFaq | null)[] = [
    doctor.hospitals.length
      ? {
          question: `Where does ${name} practise?`,
          answer: `${name} practises at ${joinList(
            doctor.hospitals.map((h) => [h.name, h.area, h.city].filter(Boolean).join(", ")),
          )}.${doctor.videoConsultEnabled ? ` ${name} also offers online video consultations across Pakistan through ZindagiCare.` : ""}`,
        }
      : null,
    credentials.length || doctor.medicalCollege
      ? {
          question: `What are ${name}'s qualifications?`,
          answer: [
            credentials.length ? `${name} holds ${joinList(credentials)}.` : null,
            doctor.medicalCollege ? `${name} graduated from ${doctor.medicalCollege}.` : null,
            doctor.pmdcVerified ? "PMDC registration is verified by ZindagiCare." : null,
          ]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    doctor.consultationFee > 0
      ? {
          question: `What is ${name}'s consultation fee?`,
          answer: `${name}'s consultation fee on ZindagiCare is ${formatFee(doctor.consultationFee)}.`,
        }
      : null,
    {
      question: `How can I book an appointment with ${name}?`,
      answer: `Choose a time on ${name}'s ZindagiCare profile and confirm the booking${
        days.length ? `. ${name} is available on ${joinList(days)}` : ""
      }.${doctor.videoConsultEnabled ? " Video consultations happen securely from home, with a digital prescription afterwards." : ""}`,
    },
    doctor.languages.length
      ? {
          question: `Which languages does ${name} speak?`,
          answer: `${name} consults in ${joinList(doctor.languages)}.`,
        }
      : null,
  ];
  return faqs.filter((f): f is DoctorPortfolioFaq => f !== null);
}

/** The doctor's own FAQs first, then generated ones covering anything they haven't. */
export function buildDoctorFaqs(doctor: PublicDoctorProfile): DoctorPortfolioFaq[] {
  const own = doctor.portfolio.faqs;
  if (doctor.faqsHidden) return own;
  const asked = new Set(own.map((f) => f.question.trim().toLowerCase()));
  return [
    ...own,
    ...buildGeneratedDoctorFaqs(doctor).filter((f) => !asked.has(f.question.toLowerCase())),
  ];
}

/**
 * The profile as rendered and described to crawlers: a factual summary stands in for a
 * missing bio, and FAQs are filled in from profile data.
 */
export function withDoctorSeoContent(doctor: PublicDoctorProfile): PublicDoctorProfile {
  return {
    ...doctor,
    bio: doctor.bio?.trim() ? doctor.bio : buildDoctorSummary(doctor),
    portfolio: { ...doctor.portfolio, faqs: buildDoctorFaqs(doctor) },
  };
}
