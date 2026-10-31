import type { PublicDoctorProfile } from "@/features/marketing/types/doctor-public";
import { mapDoctorPortfolio, toPublicDoctorPortfolio } from "@/lib/doctors/portfolio";
import {
  buildDoctorFaqs,
  buildDoctorMetaDescription,
  buildDoctorSeoTitle,
  buildDoctorSummary,
  doctorPlainName,
  withDoctorSeoContent,
} from "@/lib/seo/doctor-seo";
import { buildPhysicianSchema } from "@/lib/seo/schema";

function makeDoctor(overrides: Partial<PublicDoctorProfile> = {}): PublicDoctorProfile {
  return {
    doctorId: "6a3658fc115d81915f3d08bc",
    slug: "fatima-aslam",
    name: "Dr. Fatima Aslam",
    specialties: ["Gynecologist"],
    experienceYears: 0,
    languages: ["English", "Urdu"],
    medicalDegree: "MBBS",
    qualifications: ["FCPS Part 1", "MS Gyne & Obs"],
    medicalCollege: "Independent Medical College",
    hospitals: [{ name: "Services Hospital Lahore", city: "Lahore" }],
    pmdcVerified: true,
    consultationFee: 500,
    ratingAvg: 5,
    ratingCount: 1,
    availableSlots: 3,
    isFull: false,
    videoConsultEnabled: true,
    weeklyAvailability: [
      { dayOfWeek: 3, startTimeLocal: "18:00", endTimeLocal: "20:00" },
      { dayOfWeek: 1, startTimeLocal: "18:00", endTimeLocal: "20:00" },
    ],
    portfolio: toPublicDoctorPortfolio(mapDoctorPortfolio({})),
    ...overrides,
  };
}

describe("doctor SEO copy", () => {
  it("puts specialty and city in the title", () => {
    expect(buildDoctorSeoTitle(makeDoctor())).toBe("Dr. Fatima Aslam — Gynecologist in Lahore");
    expect(buildDoctorSeoTitle(makeDoctor({ hospitals: [] }))).toBe(
      "Dr. Fatima Aslam — Gynecologist | Online Consult Pakistan",
    );
  });

  it("strips the title prefix for the searched-for name", () => {
    expect(doctorPlainName("Dr. Fatima Aslam")).toBe("Fatima Aslam");
    expect(doctorPlainName("Prof Ali Akbar")).toBe("Ali Akbar");
    expect(doctorPlainName("Drake Khan")).toBe("Drake Khan");
  });

  it("summarises the profile in quotable sentences", () => {
    const summary = buildDoctorSummary(makeDoctor());
    expect(summary).toContain(
      "Dr. Fatima Aslam is a Gynecologist in Lahore, practising at Services Hospital Lahore.",
    );
    expect(summary).toContain("qualifications include MBBS, FCPS Part 1 and MS Gyne & Obs.");
    expect(summary).toContain("graduated from Independent Medical College.");
    expect(summary).toContain("online video consultation with Dr. Fatima Aslam on ZindagiCare for Rs. 500.");
    expect(summary).toContain("rated 5.0/5 by 1 patient on ZindagiCare.");
  });

  it("prefers the doctor's own words for the meta description and stays snippet-length", () => {
    expect(buildDoctorMetaDescription(makeDoctor({ bio: "Caring for women for a decade." }))).toBe(
      "Caring for women for a decade.",
    );
    const generated = buildDoctorMetaDescription(makeDoctor());
    expect(generated.startsWith("Dr. Fatima Aslam is a Gynecologist in Lahore")).toBe(true);
    expect(generated.length).toBeLessThanOrEqual(155);
  });

  it("adds patient FAQs after the doctor's own, without repeating a question", () => {
    const own = { question: "What is Dr. Fatima Aslam's consultation fee?", answer: "Rs. 500." };
    const doctor = makeDoctor({ portfolio: { ...makeDoctor().portfolio, faqs: [own] } });
    const faqs = buildDoctorFaqs(doctor);
    expect(faqs[0]).toEqual(own);
    expect(faqs.filter((f) => f.question === own.question)).toHaveLength(1);
    expect(faqs.find((f) => f.question.startsWith("How can I book"))?.answer).toContain(
      "available on Monday and Wednesday",
    );
  });

  it("generates no FAQs when the doctor hid that section", () => {
    expect(buildDoctorFaqs(makeDoctor({ faqsHidden: true }))).toEqual([]);
  });

  it("fills a missing bio but never replaces a written one", () => {
    expect(withDoctorSeoContent(makeDoctor()).bio).toBe(buildDoctorSummary(makeDoctor()));
    expect(withDoctorSeoContent(makeDoctor({ bio: "My own bio." })).bio).toBe("My own bio.");
  });
});

describe("buildPhysicianSchema", () => {
  it("describes the doctor with an id, plain name, address, credentials and reviews", () => {
    const schema = buildPhysicianSchema({
      ...makeDoctor(),
      reviews: [
        { rating: 5, comment: "Very kind.", patientName: "Ayesha", createdAt: "2026-10-01T10:00:00Z" },
        { rating: 4, patientName: "No comment", createdAt: "2026-10-02T10:00:00Z" },
      ],
    });
    expect(schema["@id"]).toMatch(/\/doctors\/fatima-aslam#physician$/);
    expect(schema.alternateName).toBe("Fatima Aslam");
    expect(schema.address).toMatchObject({ addressLocality: "Lahore", addressCountry: "PK" });
    expect(schema.hasCredential?.map((c) => c.name)).toEqual(["MBBS", "FCPS Part 1", "MS Gyne & Obs"]);
    expect(schema.review).toHaveLength(1);
    expect(schema.review?.[0]).toMatchObject({ datePublished: "2026-10-01", reviewBody: "Very kind." });
  });
});
