import {
  buildCityFaq,
  cityFacts,
  cityToSlug,
  lowestFee,
  rs,
  type HomeVisitCity,
} from "@/lib/seo/home-visit-cities";

function city(overrides: Partial<HomeVisitCity> = {}): HomeVisitCity {
  return {
    name: "Karachi",
    slug: "karachi",
    isMain: true,
    doctors: [],
    nurses: [],
    physiotherapists: [],
    ...overrides,
  };
}

const doctor = (homeVisitFee: number) =>
  ({
    slug: `doc-${homeVisitFee}`,
    name: "Dr. Test",
    specialty: "General Physician",
    homeVisitFee,
  }) as HomeVisitCity["doctors"][number];
const nurse = (homeVisitFee: number) =>
  ({
    slug: `nurse-${homeVisitFee}`,
    homeVisitFee,
    homeVisitEnabled: true,
  }) as HomeVisitCity["nurses"][number];

describe("home-visit city helpers", () => {
  it("turns free-text city names into stable URL slugs", () => {
    expect(cityToSlug("  Faisalabad ")).toBe("faisalabad");
    expect(cityToSlug("Dera Ghazi Khan")).toBe("dera-ghazi-khan");
    expect(cityToSlug("RAHIM YAR KHAN!")).toBe("rahim-yar-khan");
  });

  it("ignores unset (zero) fees when picking the lowest", () => {
    expect(lowestFee([0, 3500, 2500])).toBe(2500);
    expect(lowestFee([0, 0])).toBeUndefined();
  });

  it("formats rupees with thousands separators", () => {
    expect(rs(3500)).toBe("Rs. 3,500");
  });
});

describe("cityFacts", () => {
  it("main city with no listed providers: team-fulfilment claim, platform rates, never '0 providers'", () => {
    const facts = cityFacts(city());
    expect(facts.serviceList).toBe("doctors, nurses and physiotherapists");
    expect(facts.coverage).toBe(
      "Our care team assigns a verified provider to every request in Karachi",
    );
    expect(facts.prices).toEqual([
      "doctor home visits from Rs. 3,500",
      "nursing visits from Rs. 1,800",
      "home physiotherapy from Rs. 2,800",
    ]);
    expect(JSON.stringify(facts)).not.toMatch(/\b0 verified/);
  });

  it("main city with providers: states the count and takes the cheaper of provider fee and platform rate", () => {
    const facts = cityFacts(city({ doctors: [doctor(0)], nurses: [nurse(1500)] }));
    expect(facts.coverage).toBe(
      "2 verified providers currently take home visits in Karachi, and our care team assigns a verified provider to every request in Karachi",
    );
    expect(facts.prices).toContain("nursing visits from Rs. 1,500");
    // A doctor without their own fee falls back to the platform rate, not Rs. 0.
    expect(facts.prices).toContain("doctor home visits from Rs. 3,500");
  });

  it("non-main city only claims what its listed providers offer", () => {
    const facts = cityFacts(
      city({ name: "Multan", slug: "multan", isMain: false, doctors: [doctor(0)] }),
    );
    expect(facts.serviceList).toBe("doctors");
    expect(facts.coverage).toBe("1 verified provider currently takes home visits in Multan");
    expect(facts.coverage).not.toMatch(/care team/);
    expect(facts.prices).toEqual([]);
  });
});

describe("buildCityFaq", () => {
  it("main city: booking, who, cost (with nurse procedures) and safety questions", () => {
    const faq = buildCityFaq(city({ name: "Faisalabad", slug: "faisalabad" }));
    expect(faq.map((f) => f.q)).toEqual([
      "How do I book a doctor home visit in Faisalabad?",
      "Who does home visits in Faisalabad on ZindagiCare?",
      "How much does a home visit cost in Faisalabad?",
      "Is the visit tracked and safe?",
    ]);
    expect(faq[0]!.a).toContain("/home-services/faisalabad");
    expect(faq[2]!.a).toContain("IV drips (Rs. 2,500)");
  });

  it("drops the cost question when no price is known and omits nurse procedures without nurses", () => {
    const faq = buildCityFaq(
      city({ name: "Multan", slug: "multan", isMain: false, doctors: [doctor(0)] }),
    );
    expect(faq.some((f) => f.q.startsWith("How much"))).toBe(false);
    expect(faq.map((f) => f.a).join(" ")).not.toContain("IV drips");
  });
});
