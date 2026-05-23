import { siteConfig } from "@/config/site";

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
    id: "home-care",
    image: "/hero/home-care.jpg",
    imageAlt: "Nurse providing in-home patient care",
    carousel: {
      eyebrow: "In-house patient treatment",
      title: "Professional care at",
      titleHighlight: "your home",
      description:
        "Licensed doctors and nurses visit you at home for check-ups, IV drips, injections, wound dressing, and post-operative care — with transparent pricing and verified staff across Lahore.",
      badge: "IV drips · Nursing · Doctor visits",
      ctaLabel: "Book home visit",
      href: siteConfig.links.homeServices,
    },
    card: {
      title: "Home Patient Care",
      description: "Doctor or nurse visits at your doorstep with IVs and special treatments.",
    },
  },
  {
    id: "online-consult",
    image: "/hero/online-consult.jpg",
    imageAlt: "Patient on a video call with a doctor",
    carousel: {
      eyebrow: "Online consultation",
      title: "Talk to PMDC doctors via",
      titleHighlight: "secure video",
      description:
        "Book a slot, join a private HD video room, share symptoms and reports in chat, and receive digital prescriptions — including free 10-minute Sunday consults with verified specialists.",
      badge: "Free Sunday slots · HD video · E-prescription",
      ctaLabel: "Consult online now",
      href: siteConfig.links.doctors,
    },
    card: {
      title: "Consult Online Now",
      description: "Instantly connect with specialists through secure video calls.",
    },
  },
  {
    id: "in-clinic",
    image: "/hero/in-clinic.jpg",
    imageAlt: "Doctor consulting a patient in clinic",
    carousel: {
      eyebrow: "In-clinic check-up",
      title: "Book trusted doctors for",
      titleHighlight: "in-person visits",
      description:
        "Choose your hospital or clinic, pick a time that works, and see PMDC-verified doctors in person — with ratings, fees, and location shown upfront before you confirm.",
      badge: "500+ verified doctors",
      ctaLabel: "Find a clinic appointment",
      href: siteConfig.links.doctors,
    },
    card: {
      title: "In-Clinic Appointments",
      description: "Book an in-person visit at your preferred hospital or clinic.",
    },
  },
  {
    id: "lab-tests",
    image: "/hero/lab-tests.jpg",
    imageAlt: "Medical professional handling laboratory samples",
    carousel: {
      eyebrow: "Laboratory tests",
      title: "Lab tests with",
      titleHighlight: "home collection",
      description:
        "Order blood work and diagnostics with sample pickup at home or partner labs in Lahore — track results in your account and enjoy exclusive discounts on popular panels.",
      badge: "Home sample pickup · Partner labs",
      ctaLabel: "Book a lab test",
      href: siteConfig.links.homeServices,
    },
    card: {
      title: "Laboratory Tests",
      description: "Avail exclusive discounts on lab tests with convenient sample collection.",
    },
  },
  {
    id: "medicines",
    image: "/hero/medicines.jpg",
    imageAlt: "Medicines prepared for home delivery",
    carousel: {
      eyebrow: "Medicine delivery",
      title: "Prescription medicines",
      titleHighlight: "to your door",
      description:
        "Upload or use your e-prescription, compare brands, and get authentic medicines delivered quickly — with dosage guidance so you know your medicines better.",
      badge: "Verified pharmacies · Fast delivery",
      ctaLabel: "Order medicines",
      href: siteConfig.links.dashboard,
    },
    card: {
      title: "Medicines",
      description: "Order authentic medicines with guidance on dosage and usage.",
    },
  },
];

/** Fixed carousel height — all slides share this size */
export const HERO_CAROUSEL_HEIGHT =
  "h-[26rem] sm:h-[28rem] lg:h-[30rem]" as const;
