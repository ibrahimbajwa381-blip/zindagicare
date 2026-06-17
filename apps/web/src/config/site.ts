import { LAUNCH_CITY } from "@zindagi/shared";

/** @see {@link theme} in `./theme.ts` for brand colors (teal/green + blue) */
export { theme } from "./theme";

export const siteConfig = {
  name: "ZindagiCare",
  logo: "/logo1.png",
  favicon: "/favicon.ico",
  icon: "/icon-192.png",
  tagline: "At-home medical care, online consults & free Sunday care",
  description:
    "Lahore's at-home medical care — verified doctors and nurses visit you with geo-tracked, transparent-priced visits. Plus secure online video consultations and free 10-minute Sunday consults (Rs. 0).",
  launchCity: LAUNCH_CITY,
  supportEmail: "support@zindagicare.pk",
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
    forDoctors: "/for-doctors",
    forNurses: "/for-nurses",
    privacy: "/privacy",
    terms: "/terms",
    refundPolicy: "/refund-policy",
    telemedicineConsent: "/telemedicine-consent",
    dashboard: "/dashboard",
    messages: "/messages",
    doctorMessages: "/doctor/messages",
  },
  nav: {
    main: [
      { label: "In-house medical services", href: "/home-services" },
      { label: "Online consultation", href: "/doctors" },
      {
        label: "Sunday Free Consult",
        href: "/sunday-consult",
        badge: "Free",
      },
    ],
  },
} as const;
