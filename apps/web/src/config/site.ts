import { LAUNCH_CITY } from "@zindagi/shared";

/** @see {@link theme} in `./theme.ts` for brand colors (teal/green + blue) */
export { theme } from "./theme";

export const siteConfig = {
  name: "ZindagiCare",
  logo: "/logo1.png",
  tagline: "Healthcare that feels premium, fast, and trustworthy",
  description:
    "Book PMDC-verified doctors in Lahore. Free 10-minute Sunday video consults (Rs. 0), home visits, and medicine delivery — all in one place.",
  launchCity: LAUNCH_CITY,
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  links: {
    doctors: "/doctors",
    sundayConsult: "/sunday-consult",
    homeServices: "/home-services",
    login: "/login",
    register: "/register",
    dashboard: "/dashboard",
  },
} as const;
