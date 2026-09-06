import { resolveMediaUrl } from "@/lib/config";

describe("resolveMediaUrl", () => {
  it("returns undefined for a nullish path", () => {
    expect(resolveMediaUrl(undefined)).toBeUndefined();
    expect(resolveMediaUrl(null)).toBeUndefined();
    expect(resolveMediaUrl("")).toBeUndefined();
  });

  it("passes absolute http(s) URLs through unchanged", () => {
    expect(resolveMediaUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(resolveMediaUrl("http://example.com/a.png")).toBe("http://example.com/a.png");
  });

  it("prefixes a host-relative path with the API URL", () => {
    expect(resolveMediaUrl("/api/v1/public/doctor-avatars/a.png")).toBe(
      "http://localhost:3000/api/v1/public/doctor-avatars/a.png",
    );
  });

  it("adds the missing leading slash for a bare relative path", () => {
    expect(resolveMediaUrl("avatars/a.png")).toBe("http://localhost:3000/avatars/a.png");
  });
});
