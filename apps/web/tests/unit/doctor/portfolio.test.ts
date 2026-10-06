import {
  doctorPortfolioSuggestions,
  isAllowedPortfolioLink,
  parseYouTubeVideoId,
} from "@zindagi/shared";
import { updateDoctorPortfolioSchema } from "@zindagi/validators";
import {
  doctorPortfolioChecklist,
  doctorPortfolioCompleteness,
  doctorPortfolioVideoId,
  mapDoctorPortfolio,
  toPublicDoctorPortfolio,
} from "@/lib/doctors/portfolio";
import { doctorShortLinkPath } from "@/lib/doctors/profile-path";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("parseYouTubeVideoId", () => {
  it.each([
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com/watch?v=${VIDEO_ID}&t=42s`,
    `https://m.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}?si=abc123`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    `  https://youtu.be/${VIDEO_ID}  `,
  ])("extracts the id from %s", (url) => {
    expect(parseYouTubeVideoId(url)).toBe(VIDEO_ID);
  });

  it.each([
    "",
    "not a url",
    `https://vimeo.com/${VIDEO_ID}`,
    `https://evil.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com.evil.com/watch?v=${VIDEO_ID}`,
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/@channel",
    `javascript:alert(1)//youtu.be/${VIDEO_ID}`,
  ])("rejects %s", (url) => {
    expect(parseYouTubeVideoId(url)).toBeNull();
  });
});

describe("isAllowedPortfolioLink", () => {
  it("allows each platform only on its own domain over https", () => {
    expect(isAllowedPortfolioLink("linkedin", "https://www.linkedin.com/in/dr-ali")).toBe(true);
    expect(isAllowedPortfolioLink("linkedin", "https://pk.linkedin.com/in/dr-ali")).toBe(true);
    expect(isAllowedPortfolioLink("linkedin", "https://linkedin.com.evil.com/in/x")).toBe(false);
    expect(isAllowedPortfolioLink("linkedin", "http://www.linkedin.com/in/dr-ali")).toBe(false);
    expect(isAllowedPortfolioLink("googleScholar", "https://scholar.google.com/citations?user=x")).toBe(true);
    expect(isAllowedPortfolioLink("googleScholar", "https://google.com/x")).toBe(false);
  });

  it("allows any https website but never other schemes or credentials", () => {
    expect(isAllowedPortfolioLink("website", "https://drali-clinic.pk")).toBe(true);
    expect(isAllowedPortfolioLink("website", "javascript:alert(1)")).toBe(false);
    expect(isAllowedPortfolioLink("website", "data:text/html,hi")).toBe(false);
    expect(isAllowedPortfolioLink("website", "https://user:pass@clinic.pk")).toBe(false);
    expect(isAllowedPortfolioLink("website", "https://localhost")).toBe(false);
  });
});

describe("updateDoctorPortfolioSchema", () => {
  it("accepts a single-section patch and trims text", () => {
    expect(updateDoctorPortfolioSchema.parse({ headline: "  Heart specialist  " })).toEqual({
      headline: "Heart specialist",
    });
  });

  it("normalizes any YouTube link to a canonical watch URL and allows clearing", () => {
    expect(
      updateDoctorPortfolioSchema.parse({ introVideoUrl: `https://youtu.be/${VIDEO_ID}?si=x` }),
    ).toEqual({ introVideoUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}` });
    expect(updateDoctorPortfolioSchema.parse({ introVideoUrl: "" })).toEqual({ introVideoUrl: "" });
    expect(
      updateDoctorPortfolioSchema.safeParse({ introVideoUrl: "https://vimeo.com/123" }).success,
    ).toBe(false);
  });

  it("de-duplicates tags and requires at least one language", () => {
    const parsed = updateDoctorPortfolioSchema.parse({
      conditionsTreated: ["Diabetes", " diabetes ", "Hypertension"],
    });
    expect(parsed.conditionsTreated).toEqual(["Diabetes", "Hypertension"]);
    expect(updateDoctorPortfolioSchema.safeParse({ languages: [] }).success).toBe(false);
  });

  it("validates services, including optional whole-number fees", () => {
    const parsed = updateDoctorPortfolioSchema.parse({
      services: [{ name: "ECG", fee: 1500 }, { name: "Echo", description: "  " }],
    });
    expect(parsed.services).toEqual([
      { name: "ECG", fee: 1500 },
      { name: "Echo", description: undefined },
    ]);
    expect(updateDoctorPortfolioSchema.safeParse({ services: [{ name: "ECG", fee: -1 }] }).success).toBe(false);
    expect(updateDoctorPortfolioSchema.safeParse({ services: [{ name: "ECG", fee: 10.5 }] }).success).toBe(false);
    expect(updateDoctorPortfolioSchema.safeParse({ services: [{ name: "" }] }).success).toBe(false);
  });

  it("rejects unsafe or off-platform links", () => {
    expect(
      updateDoctorPortfolioSchema.safeParse({ links: { linkedin: "https://evil.com/in/x" } }).success,
    ).toBe(false);
    expect(
      updateDoctorPortfolioSchema.safeParse({ links: { website: "javascript:alert(1)" } }).success,
    ).toBe(false);
    expect(
      updateDoctorPortfolioSchema.safeParse({
        publications: [{ title: "Paper", url: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
    const ok = updateDoctorPortfolioSchema.parse({
      links: { website: "https://clinic.pk", linkedin: "" },
    });
    expect(ok.links).toEqual({ website: "https://clinic.pk", linkedin: undefined });
  });

  it("rejects unknown keys, unknown sections and bad FAQs", () => {
    expect(updateDoctorPortfolioSchema.safeParse({ pmdcNumber: "123" }).success).toBe(false);
    expect(updateDoctorPortfolioSchema.safeParse({ links: { tiktok: "https://tiktok.com/x" } }).success).toBe(false);
    expect(updateDoctorPortfolioSchema.safeParse({ hiddenSections: ["about"] }).success).toBe(false);
    expect(updateDoctorPortfolioSchema.safeParse({ faqs: [{ question: "Hi?", answer: "Yes" }] }).success).toBe(false);
    expect(
      updateDoctorPortfolioSchema.parse({ hiddenSections: ["faqs", "faqs", "video"] }).hiddenSections,
    ).toEqual(["faqs", "video"]);
  });
});

describe("doctor portfolio mapping & completeness", () => {
  const emptyContext = { hospitalCount: 0, weeklySlotCount: 0 };

  it("maps an empty profile to empty lists and 0%", () => {
    const p = mapDoctorPortfolio({});
    expect(p.services).toEqual([]);
    expect(p.links).toEqual({});
    expect(p.headline).toBeUndefined();
    expect(doctorPortfolioCompleteness(doctorPortfolioChecklist(p, emptyContext))).toBe(0);
  });

  it("drops blank rows, bad links and invalid videos from the database", () => {
    const p = mapDoctorPortfolio({
      languages: ["English", null, ""],
      portfolio: {
        headline: "  ",
        introVideoUrl: "https://vimeo.com/1",
        services: [{ name: "" }, { name: "ECG", fee: -5 }, null],
        faqs: [{ question: "Q?", answer: "" }],
        publications: [{ title: "Paper", url: "javascript:alert(1)" }],
        links: { linkedin: "https://evil.com", website: "https://clinic.pk" },
        hiddenSections: ["faqs", "about", "nonsense"],
      },
    });
    expect(p.languages).toEqual(["English"]);
    expect(p.headline).toBeUndefined();
    expect(p.introVideoUrl).toBeUndefined();
    expect(p.services).toEqual([{ name: "ECG", description: undefined, fee: undefined }]);
    expect(p.faqs).toEqual([]);
    expect(p.publications[0].url).toBeUndefined();
    expect(p.links).toEqual({ website: "https://clinic.pk" });
    expect(p.hiddenSections).toEqual(["faqs"]);
  });

  it("reaches 100% only when every core item is done", () => {
    const p = mapDoctorPortfolio({
      bio: "x".repeat(120),
      portfolio: {
        headline: "Cardiologist",
        conditionsTreated: ["A", "B", "C"],
        services: [{ name: "ECG" }],
        experience: [{ role: "Consultant", organization: "Mayo" }],
        education: [{ degree: "FCPS", institute: "CPSP" }],
      },
    });
    const full = { avatarUrl: "/a.jpg", hospitalCount: 1, weeklySlotCount: 2 };
    expect(doctorPortfolioCompleteness(doctorPortfolioChecklist(p, full))).toBe(100);
    const noHours = doctorPortfolioChecklist(p, { ...full, weeklySlotCount: 0 });
    expect(noHours.find((i) => i.id === "clinics")?.done).toBe(false);
    expect(doctorPortfolioCompleteness(noHours)).toBe(86);
  });

  it("strips hidden sections before the portfolio reaches the public page", () => {
    const p = mapDoctorPortfolio({
      portfolio: {
        introVideoUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
        faqs: [{ question: "Do you see kids?", answer: "Yes" }],
        services: [{ name: "ECG" }],
        links: { website: "https://clinic.pk" },
        hiddenSections: ["faqs", "video", "links"],
      },
    });
    const pub = toPublicDoctorPortfolio(p);
    expect(pub.faqs).toEqual([]);
    expect(pub.introVideoUrl).toBeUndefined();
    expect(doctorPortfolioVideoId(pub)).toBeNull();
    expect(pub.links).toEqual({});
    expect(pub.services).toEqual([{ name: "ECG", description: undefined, fee: undefined }]);
    expect(pub.hiddenSections).toEqual([]);
    expect(doctorPortfolioVideoId(p)).toBe(VIDEO_ID);
  });
});

describe("specialty suggestions & short link", () => {
  it("merges suggestions across specialties and falls back to general ones", () => {
    const merged = doctorPortfolioSuggestions(["Cardiologist", "Diabetologist"]);
    expect(merged.conditions).toContain("Heart failure");
    expect(merged.conditions).toContain("Prediabetes");
    expect(new Set(merged.conditions).size).toBe(merged.conditions.length);
    expect(doctorPortfolioSuggestions(["Unknown specialty"]).services).toContain("Second opinion");
  });

  it("builds an encoded /dr short link", () => {
    expect(doctorShortLinkPath("ali-khan")).toBe("/dr/ali-khan");
    expect(doctorShortLinkPath("a/b")).toBe("/dr/a%2Fb");
  });
});
