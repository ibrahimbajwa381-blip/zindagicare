/** Marketing portraits for doctor & nurse onboarding (Pakistani healthcare professionals). */
export const PROVIDER_ONBOARDING_IMAGES = {
  doctor: {
    preview: {
      src: "/doctors/hassan-raza.jpg",
      alt: "Dr. Hassan Raza, PMDC-verified Pakistani doctor with stethoscope",
    },
    hero: {
      src: "/doctors/hassan-raza.jpg",
      alt: "Dr. Hassan Raza, PMDC-verified Pakistani doctor with stethoscope",
    },
  },
  nurse: {
    preview: {
      src: "/providers/nurse-onboarding.jpg",
      alt: "Pakistani nurse in hijab and medical scrubs in a hospital corridor",
    },
    hero: {
      src: "/providers/nurse-onboarding.jpg",
      alt: "Pakistani nurse in hijab and medical scrubs in a hospital corridor",
    },
  },
  physiotherapist: {
    preview: {
      src: "/hero/home-physio-male-pakistan.jpg",
      alt: "Male Pakistani physiotherapist providing professional home rehabilitation care",
    },
    hero: {
      src: "/hero/home-physio-male-pakistan.jpg",
      alt: "Male Pakistani physiotherapist providing professional home rehabilitation care",
    },
  },
} as const;

export function getProviderHeroImage(role: "doctor" | "nurse" | "physiotherapist") {
  return PROVIDER_ONBOARDING_IMAGES[role].hero;
}
