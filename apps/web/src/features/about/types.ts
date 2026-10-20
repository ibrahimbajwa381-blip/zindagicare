export type AboutItem = { title: string; body: string };

export type AboutFact = { label: string; value: string };

export type AboutContent = {
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    titleHighlight: string;
    intro: string;
    mottoLabel: string;
    motto: string;
    primaryCta: string;
    secondaryCta: string;
  };
  mission: {
    eyebrow: string;
    title: string;
    missionTitle: string;
    missionBody: string;
    visionTitle: string;
    visionBody: string;
    valuesTitle: string;
    /** Order: verified, transparent, accessible, compassionate. */
    values: AboutItem[];
  };
  services: {
    eyebrow: string;
    title: string;
    intro: string;
    /** Order: online, urgent, home services, physiotherapy, Sunday free, network. */
    items: AboutItem[];
  };
  sunday: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    points: string[];
    quote: string;
    patientCta: string;
    volunteerCta: string;
  };
  providers: {
    eyebrow: string;
    title: string;
    intro: string;
    /** Order: verified profile, reviews, flexible practice, earnings, reach, service. */
    items: AboutItem[];
    doctorCta: string;
    nurseCta: string;
    physioCta: string;
  };
  team: {
    eyebrow: string;
    title: string;
    intro: string;
  };
  osama: {
    name: string;
    role: string;
    subtitle: string;
    bio: string[];
    facts: AboutFact[];
    principlesTitle: string;
    /** Order: listen, explain, reach. */
    principles: AboutItem[];
    quote: string;
    photoAlt: string;
    theatreAlt: string;
    theatreCaption: string;
  };
  ibrahim: {
    name: string;
    role: string;
    subtitle: string;
    bio: string[];
    facts: AboutFact[];
    expertiseTitle: string;
    expertise: string[];
    principle: string;
    workTitle: string;
    workBody: string;
    workCta: string;
    companyCta: string;
    photoAlt: string;
  };
  closing: {
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
  };
};
