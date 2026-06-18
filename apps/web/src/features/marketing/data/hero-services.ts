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
        "Verified doctors and nurses come to you for check-ups, IV drips, injections, wound dressing, and post-op care — geo-tracked, transparent-priced, and safe across Lahore.",
      badge: "Doctor visits · Nursing · IV & injections",
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
        "Book a slot, join a private HD video room, share symptoms and reports in chat, and receive digital prescriptions from verified specialists across Lahore.",
      badge: "HD video · E-prescription · Verified doctors",
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
        "Rs. 0 for a 10-minute video consult with a PMDC-verified doctor. Book one free slot per week (first come, first served), join online at your chosen time — no clinic visit required.",
      badge: "Rs. 0 · 10 minutes · Online only",
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
  "h-[min(30rem,88dvh)] min-h-[24rem] sm:h-[28rem] sm:min-h-0 lg:h-[30rem]" as const;

/** Full-body portrait — anchor above center so the face stays in short mobile crops. */
export const HERO_USAMA_CAROUSEL_IMAGE_CLASS =
  "object-[center_30%] sm:object-[center_26%] lg:object-[center_18%]" as const;

export const HERO_USAMA_CARD_IMAGE_CLASS =
  "object-[center_26%] sm:object-[center_22%]" as const;
