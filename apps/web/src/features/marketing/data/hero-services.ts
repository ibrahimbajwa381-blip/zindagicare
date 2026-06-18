import { siteConfig } from "@/config/site";

export const SUNDAY_FREE_CONSULT_HERO_IMAGE = "/hero/freeconsultation.png";
export const HOME_SERVICES_HERO_IMAGE = "/hero/home-care-pakistan.jpg";

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
      highlights: ["Verified doctors & nurses", "Transparent pricing"],
      badge: "Doctor & nurse home visits",
      ctaLabel: "Book in-house care",
      href: siteConfig.links.homeServices,
    },
    card: {
      title: "In-house Medical Services",
      description: "Professional medical care delivered at your doorstep.",
    },
  },
  {
    id: "online-consult",
    image: "/hero/dr-usama-riyaz.png",
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
      ctaLabel: "Book free Sunday slot",
      href: siteConfig.links.sundayConsult,
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

export const HERO_USAMA_CARD_IMAGE_CLASS =
  "object-[center_26%] sm:object-[center_22%]" as const;
