import { LAUNCH_CITY } from "@zindagi/shared";
import { SEO_KEYWORDS } from "@/lib/seo/keywords";
import { marketingPageSeo } from "@/lib/seo/pages";

/** @see {@link theme} in `./theme.ts` for brand colors (teal/green + blue) */
export { theme } from "./theme";

const PRODUCTION_URL = "https://zindagicare.com";

export const siteConfig = {
  name: "ZindagiCare",
  logo: "/logo1.png",
  favicon: "/favicon.ico",
  icon: "/icon-192.png",
  tagline: "At-home medical care, online consults, urgent care & free Sunday care",
  description:
    "Pakistan's at-home medical care — verified doctors, nurses, and physiotherapists visit you in Lahore with geo-tracked, transparent-priced visits. Plus secure online video consultations, urgent care in 10 minutes, and free Sunday consults (Rs. 0).",
  seo: {
    defaultTitle: marketingPageSeo.home.title,
    defaultDescription: marketingPageSeo.home.description,
    keywords: SEO_KEYWORDS,
    alternateNames: [
      "zindagicare",
      "Zindagi Care",
      "ZindagiCare Pakistan",
      "zindagicare.com",
    ],
    sameAs: ["https://www.linkedin.com/company/134544059/"],
    googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION,
    bingSiteVerification: "926E710D97534856394734561D5740B9",
  },
  launchCity: LAUNCH_CITY,
  supportEmail: "support@zindagicare.pk",
  supportWhatsApp: "923074583567",
  supportWhatsAppDisplay: "0307 458 3567",
  url: process.env.NEXT_PUBLIC_APP_URL ?? PRODUCTION_URL,
  links: {
    doctors: "/doctors",
    sundayConsult: "/sunday-consult",
    urgentCare: "/urgent-care",
    homeServices: "/home-services",
    homeCareRequest: "/home-care/request",
    homeCareVisits: "/home-care/visits",
    login: "/login",
    register: "/register",
    registerDoctor: "/register/doctor",
    registerNurse: "/register/nurse",
    registerPhysiotherapist: "/register/physiotherapist",
    forDoctors: "/for-doctors",
    forNurses: "/for-nurses",
    forPhysiotherapists: "/for-physiotherapists",
    privacy: "/privacy",
    terms: "/terms",
    refundPolicy: "/refund-policy",
    telemedicineConsent: "/telemedicine-consent",
    dashboard: "/dashboard",
    messages: "/messages",
    doctorMessages: "/doctor/messages",
    getApp: "/get-app",
    getAppAndroid: "/get-app?platform=android",
    getAppIos: "/get-app?platform=ios",
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
      {
        label: "Urgent Care",
        href: "/urgent-care",
        badge: "Fast",
      },
    ],
  },
} as const;
