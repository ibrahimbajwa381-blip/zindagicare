import { updatePhysiotherapistPortfolioSchema } from "@zindagi/validators";
import {
  formatExperienceYears,
  mapPhysiotherapistPortfolio,
  portfolioChecklist,
  portfolioCompleteness,
} from "@/lib/physiotherapists/portfolio";

describe("updatePhysiotherapistPortfolioSchema", () => {
  it("accepts a single-section patch", () => {
    const parsed = updatePhysiotherapistPortfolioSchema.parse({ headline: "  Sports physio  " });
    expect(parsed).toEqual({ headline: "Sports physio" });
  });

  it("de-duplicates tags case-insensitively and trims them", () => {
    const parsed = updatePhysiotherapistPortfolioSchema.parse({
      conditionsTreated: ["Back pain", " back pain ", "Sciatica"],
    });
    expect(parsed.conditionsTreated).toEqual(["Back pain", "Sciatica"]);
  });

  it("drops endYear for current positions and rejects end before start", () => {
    const current = updatePhysiotherapistPortfolioSchema.parse({
      experience: [{ role: "Physio", organization: "Clinic", startYear: 2020, endYear: 2010, current: true }],
    });
    expect(current.experience?.[0].endYear).toBeUndefined();

    const bad = updatePhysiotherapistPortfolioSchema.safeParse({
      experience: [{ role: "Physio", organization: "Clinic", startYear: 2020, endYear: 2018 }],
    });
    expect(bad.success).toBe(false);
  });

  it("rejects future years and unknown keys, including the removed gallery", () => {
    const nextYear = new Date().getFullYear() + 2;
    expect(
      updatePhysiotherapistPortfolioSchema.safeParse({
        education: [{ degree: "DPT", institute: "UoL", year: nextYear }],
      }).success,
    ).toBe(false);
    expect(updatePhysiotherapistPortfolioSchema.safeParse({ website: "x" }).success).toBe(false);
    expect(
      updatePhysiotherapistPortfolioSchema.safeParse({ gallery: [{ url: "/p/1.webp" }] }).success,
    ).toBe(false);
  });
});

describe("portfolio mapping & completeness", () => {
  it("maps an empty staff profile to empty lists", () => {
    const p = mapPhysiotherapistPortfolio({});
    expect(p.experience).toEqual([]);
    expect(p.headline).toBeUndefined();
    expect(portfolioCompleteness(portfolioChecklist(p))).toBe(0);
  });

  it("ignores nulls and blank rows from the database", () => {
    const p = mapPhysiotherapistPortfolio({
      languages: ["English", null, ""],
      portfolio: {
        headline: "  ",
        education: [{ degree: "DPT", institute: "UoL", year: 2019 }, { degree: null }],
      },
    });
    expect(p.languages).toEqual(["English"]);
    expect(p.headline).toBeUndefined();
    expect(p.education).toEqual([{ degree: "DPT", institute: "UoL", year: 2019 }]);
  });

  it("reaches 100% only when every checklist item is done", () => {
    const p = mapPhysiotherapistPortfolio({
      bio: "x".repeat(120),
      portfolio: {
        headline: "Neuro rehab specialist",
        conditionsTreated: ["Stroke", "Parkinson's", "Cerebral palsy"],
        techniques: ["Gait training"],
        experience: [{ role: "Physio", organization: "Hospital", startYear: 2018, current: true }],
        education: [{ degree: "DPT", institute: "UoL" }],
        certifications: [{ title: "Dry needling" }],
      },
    });
    expect(portfolioCompleteness(portfolioChecklist(p))).toBe(83); // 5/6 without a profile photo
    expect(portfolioCompleteness(portfolioChecklist(p, "/avatar.webp"))).toBe(100);
    expect(formatExperienceYears(p.experience[0])).toBe("2018 – Present");
  });
});
