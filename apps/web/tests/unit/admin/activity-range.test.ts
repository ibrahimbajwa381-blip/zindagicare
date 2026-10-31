import { parseActivityRange } from "@/server/services/activity-log.service";

describe("parseActivityRange", () => {
  it.each(["day", "week", "month"] as const)("accepts %s", (range) => {
    expect(parseActivityRange(range)).toBe(range);
  });

  it.each([null, undefined, "", "year", "DAY", "7d"])("falls back to week for %p", (value) => {
    expect(parseActivityRange(value)).toBe("week");
  });
});
