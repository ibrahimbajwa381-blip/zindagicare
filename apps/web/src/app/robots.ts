import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/doctors", "/doctors/"],
        disallow: [
          "/admin",
          "/admin/",
          "/dashboard",
          "/doctor",
          "/doctor/",
          "/nurse",
          "/nurse/",
          "/physiotherapist",
          "/physiotherapist/",
          "/login",
          "/register",
          "/onboarding",
          "/api/",
          "/consult/",
          "/messages",
          "/prescriptions",
          "/intake/",
          "/home-care/visits",
          "/doctors/booking",
          "/urgent-care/pay",
          "/urgent-care/success",
          "/urgent-care/failed",
          "/~offline",
        ],
      },
    ],
    sitemap: getSiteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
