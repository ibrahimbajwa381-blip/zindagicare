import { formatKarachi } from "@/lib/format-date";

describe("formatKarachi", () => {
  it("formats an ISO string in the Asia/Karachi timezone", () => {
    // 2026-01-01T05:00:00.000Z is 10:00 AM in Asia/Karachi (UTC+5).
    const result = formatKarachi("2026-01-01T05:00:00.000Z");
    expect(result).toContain("10:00");
    expect(result).toContain("Jan");
    expect(result).toContain("1");
  });
});
