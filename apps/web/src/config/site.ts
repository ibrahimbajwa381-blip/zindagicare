import { LAUNCH_CITY } from "@zindagi/shared";

/** @see {@link theme} in `./theme.ts` for brand colors (teal/green + blue) */
export { theme } from "./theme";

export const siteConfig = {
  name: "ZindagiCare",
  logo: "/logo1.png",
  tagline: "Online consults, free Sunday care, and in-house medical services",
  description:
    "PMDC-verified doctors in Lahore — book secure online video consultations, free 10-minute Sunday consults (Rs. 0), and licensed in-house medical care at your home.",
  launchCity: LAUNCH_CITY,
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  links: {
    doctors: "/doctors",
    sundayConsult: "/sunday-consult",
    homeServices: "/home-services",
    homeCareRequest: "/home-care/request",
    homeCareVisits: "/home-care/visits",
    login: "/login",
    register: "/register",
    registerDoctor: "/register/doctor",
    registerNurse: "/register/nurse",
    dashboard: "/dashboard",
    messages: "/messages",
    doctorMessages: "/doctor/messages",
  },
  nav: {
    main: [
      { label: "Online consultation", href: "/doctors" },
      {
        label: "Sunday Free Consult",
        href: "/sunday-consult",
        badge: "Free",
      },
      { label: "In-house medical services", href: "/home-services" },
    ],
  },
} as const;
