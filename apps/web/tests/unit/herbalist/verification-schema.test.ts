import { herbalistVerificationSchema } from "@zindagi/validators";

describe("herbalistVerificationSchema degree", () => {
  const degree = herbalistVerificationSchema.shape.degree;

  it.each(["BEMS", "FTJ"])("accepts %s", (value) => {
    expect(degree.parse(value)).toBe(value);
  });

  it.each(["BAMS", "DHMS", "MBBS", "bems", "", undefined])("rejects %p", (value) => {
    const result = degree.safeParse(value);
    expect(result.success).toBe(false);
  });

  it("explains the allowed qualifications", () => {
    const result = degree.safeParse("BAMS");
    expect(result.error?.issues[0]?.message).toBe("Qualification must be BEMS or FTJ");
  });
});
