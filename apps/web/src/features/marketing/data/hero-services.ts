import { siteConfig } from "@/config/site";

export const SUNDAY_FREE_CONSULT_HERO_IMAGE = "/hero/freeconsultation.webp";
export const HOME_SERVICES_HERO_IMAGE = "/hero/home-care-pakistan.webp";
export const HOME_PHYSIO_HERO_IMAGE = "/hero/home-physio-male-pakistan.webp";
/** Doctor on a phone / video consult — used for urgent care hero & banners */
export const URGENT_CARE_HERO_IMAGE = "/hero/online-consult.jpg";
export const ONLINE_CONSULT_HERO_IMAGE = "/hero/dr-usama-riyaz.webp";

export type HeroService = {
  id: string;
  image: string;
  imageAlt: string;
  carousel: {
    eyebrow: string;
    title: string;
    titleHighlight: string;
    description: string;
    highlights: string[];
    badge: string;
    ctaLabel: string;
    href: string;
  };
  card: {
    title: string;
    description: string;
  };
};

export const heroServices: HeroService[] = [
  {
    id: "in-house-medical",
    image: HOME_SERVICES_HERO_IMAGE,
    imageAlt: "Pakistani doctor and nurse providing in-house patient care at home",
    carousel: {
      eyebrow: "In-house medical services",
      title: "A doctor at",
      titleHighlight: "your home",
      description:
        "Verified doctors and nurses visit you at home in Lahore.",
      highlights: ["Verified doctors, nurses & physios", "Transparent pricing"],
      badge: "Doctor, nurse & physio home visits",
      ctaLabel: "Book in-house care",
      href: siteConfig.links.homeServices,
    },
    card: {
      title: "In-house Medical Services",
      description: "Professional medical care delivered at your doorstep.",
    },
  },
  {
    id: "home-physiotherapy",
    image: HOME_PHYSIO_HERO_IMAGE,
    imageAlt:
      "Male Pakistani physiotherapist providing professional home rehabilitation care in Lahore",
    carousel: {
      eyebrow: "Home physiotherapy",
      title: "Physiotherapy at",
      titleHighlight: "your home",
      description:
        "Verified male or female physiotherapists visit you in Lahore — tell us your preference when you book. Rehab, mobility, and pain relief from Rs. 2,800.",
      highlights: [
        "Male or female physio on request",
        "Rs. 2,800 per session",
      ],
      badge: "Male & female physios · Lahore",
      ctaLabel: "Book home physiotherapy",
      href: siteConfig.links.homePhysiotherapy,
    },
    card: {
      title: "Home Physiotherapy",
      description:
        "Professional rehab at home — request a male or female physiotherapist to match your comfort.",
    },
  },
  {
    id: "urgent-care",
    image: URGENT_CARE_HERO_IMAGE,
    imageAlt: "PMDC doctor on urgent phone consultation via ZindagiCare",
    carousel: {
      eyebrow: "Urgent Care",
      title: "Doctor call in",
      titleHighlight: "10 minutes",
      description:
        "Share your WhatsApp number — pay Rs. 2,000 and a PMDC-verified doctor calls you within 5–10 minutes.",
      highlights: ["Video consult in 5–10 min", "Rs. 2,000 flat fee"],
      badge: "Fast · PMDC verified · Video consult",
      ctaLabel: "Pay & get urgent care",
      href: `${siteConfig.links.urgentCare}#request`,
    },
    card: {
      title: "Urgent Care",
      description: "Need a doctor now? Get a secure video consult within 10 minutes.",
    },
  },
  {
    id: "online-consult",
    image: "/hero/dr-usama-riyaz.webp",
    imageAlt: "Dr. Usama Riyaz, founder of Zindagi Care, in medical scrubs",
    carousel: {
      eyebrow: "Online consultation",
      title: "Talk to PMDC doctors via",
      titleHighlight: "secure video",
      description:
        "Book a video slot with PMDC-verified doctors in Lahore.",
      highlights: ["PMDC verified specialists", "E-prescriptions included"],
      badge: "PMDC verified · Secure video call",
      ctaLabel: "Book online consultation",
      href: siteConfig.links.doctors,
    },
    card: {
      title: "Online Consultation",
      description: "Connect with specialists through secure video calls from home.",
    },
  },
  {
    id: "sunday-consult",
    image: SUNDAY_FREE_CONSULT_HERO_IMAGE,
    imageAlt: "Free Sunday video consultation on ZindagiCare",
    carousel: {
      eyebrow: "Sunday Free Consult",
      title: "Free doctor video call",
      titleHighlight: "every Sunday",
      description:
        "Free 10-minute video consult with a PMDC-verified doctor.",
      highlights: ["Completely free · Rs. 0", "Every Sunday online"],
      badge: "Free · Rs. 0 · Every Sunday",
      ctaLabel: "Request free Sunday consult",
      href: `${siteConfig.links.sundayConsult}#request`,
    },
    card: {
      title: "Sunday Free Consult",
      description: "Complimentary weekly video consults with verified doctors.",
    },
  },
];

/** Fixed carousel height — all slides share this size */
export const HERO_CAROUSEL_HEIGHT =
  "h-[min(32rem,90dvh)] min-h-[26rem] sm:h-[30rem] sm:min-h-0 lg:h-[32rem]" as const;

/** Full-body portrait — anchor above center so the face stays in short mobile crops. */
export const HERO_USAMA_CAROUSEL_IMAGE_CLASS =
  "object-[center_30%] sm:object-[center_26%] lg:object-[center_18%]" as const;

/** Urgent care hero — mobile crop is short; anchor higher so the doctor's face stays visible. */
export const URGENT_CARE_HERO_IMAGE_CLASS =
  "object-[center_14%] sm:object-[center_18%] lg:object-[center_22%]" as const;

/** Home physiotherapy hero — anchor toward therapist and patient interaction. */
export const HOME_PHYSIO_HERO_IMAGE_CLASS =
  "object-[center_35%] sm:object-[center_30%] lg:object-[center_25%]" as const;

export const HERO_USAMA_CARD_IMAGE_CLASS =
  "object-[center_26%] sm:object-[center_22%]" as const;
