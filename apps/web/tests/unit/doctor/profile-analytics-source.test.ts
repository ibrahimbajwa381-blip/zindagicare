import { classifySource } from "@/server/services/doctor-profile-analytics.service";

describe("classifySource", () => {
  it("marks events recorded before source tracking as unknown", () => {
    expect(classifySource(undefined)).toBe("unknown");
    expect(classifySource({})).toBe("unknown");
  });

  it("credits the doctor's share link via utm_source", () => {
    expect(classifySource({ entry: "1", utmSource: "share_link", referrer: "www.google.com" })).toBe(
      "share_link",
    );
  });

  it("maps external referrers on landing views", () => {
    expect(classifySource({ entry: "1", referrer: "www.google.com.pk" })).toBe("google");
    expect(classifySource({ entry: "1", referrer: "l.facebook.com" })).toBe("facebook");
    expect(classifySource({ entry: "1", referrer: "l.instagram.com" })).toBe("instagram");
    expect(classifySource({ entry: "1", referrer: "t.co" })).toBe("social_other");
    expect(classifySource({ entry: "1", referrer: "someblog.pk" })).toBe("other_website");
    expect(classifySource({ entry: "1" })).toBe("direct");
  });

  it("maps in-app navigation by the previous page", () => {
    expect(classifySource({ fromPath: "/doctors" })).toBe("zc_listing");
    expect(classifySource({ fromPath: "/doctors/specialty/cardiologist" })).toBe("zc_specialty");
    expect(classifySource({ fromPath: "/questions/abc" })).toBe("zc_qa");
    expect(classifySource({ fromPath: "/" })).toBe("zc_home");
    expect(classifySource({ device: "mobile" })).toBe("zc_other");
  });
});
