import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/dashboard",
          "/doctor/",
          "/nurse/",
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
        ],
      },
    ],
    sitemap: getSiteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
