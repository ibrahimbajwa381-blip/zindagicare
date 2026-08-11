import type { LegalDocument, LegalDocumentSlug } from "@/features/legal/types";

const CONTACT = "info.zindagicare@gmail.com";
const LAST_UPDATED = "Last updated: 17 July 2026";

const privacy: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: LAST_UPDATED,
  intro:
    "ZindagiCare (“we”, “us”, “our”) is a healthcare marketplace that connects patients with PMDC-verified doctors and licensed care providers in Pakistan. This Privacy Policy explains how we collect, use, store, and protect your personal and health-related information when you use our website, mobile experiences, and related services.",
  sections: [
    {
      id: "information-we-collect",
      title: "1. Information we collect",
      paragraphs: ["We collect information necessary to provide safe, reliable healthcare services:"],
      bullets: [
        "Account details: name, email, mobile number, password (stored hashed), preferred language, and city.",
        "Identity and verification (providers): PMDC registration number, nursing license, CNIC, degrees, certificates, and documents you upload during onboarding.",
        "Health and booking data: appointment details, medical intake forms, chat messages with providers, home-visit addresses, visit notes, prescriptions where applicable, and reviews.",
        "Payment data: transaction amounts, payment status, and gateway references from JazzCash or EasyPaisa. We do not store your wallet PIN or full payment credentials.",
        "Video consult metadata: session join/leave times and appointment linkage. Video is delivered through our video provider; we do not record consultations unless explicitly disclosed and consented to.",
        "Technical data: device type, browser, IP address, cookies, and usage logs used for security, fraud prevention, and service improvement.",
        "Location data: approximate or precise location when you request home visits or when geo features are enabled, with your permission.",
      ],
    },
    {
      id: "how-we-use",
      title: "2. How we use your information",
      paragraphs: ["We use your information to:"],
      bullets: [
        "Create and manage your account and authenticate you securely.",
        "Facilitate bookings, video consultations, Sunday free consults, and home-care visits.",
        "Verify provider credentials (PMDC, nursing licenses) before listing or dispatch.",
        "Process payments, refunds, and provider payouts.",
        "Send appointment reminders, OTP codes, and service notifications.",
        "Provide customer support and resolve disputes.",
        "Improve platform safety, detect abuse, and comply with applicable law.",
        "Generate anonymised or aggregated analytics that do not identify you.",
      ],
    },
    {
      id: "legal-bases",
      title: "3. Legal basis and consent",
      paragraphs: [
        "We process personal data based on your consent, contractual necessity (to deliver the service you request), legal obligations, and legitimate interests such as fraud prevention and platform security.",
        "Health-related data receives heightened protection. By booking a consult or home visit, you consent to sharing relevant medical information with the assigned provider for your care. You may withdraw marketing consent at any time; withdrawing consent for essential processing may limit our ability to provide services.",
      ],
    },
    {
      id: "sharing",
      title: "4. When we share information",
      paragraphs: ["We do not sell your personal or health data. We may share information with:"],
      bullets: [
        "Healthcare providers you choose to book (doctors, nurses) — only what is needed for your care.",
        "Payment processors (JazzCash, EasyPaisa) to complete transactions.",
        "Infrastructure and service providers (hosting, database, video, SMS/OTP) under strict confidentiality obligations.",
        "Law enforcement or regulators when required by applicable Pakistani law or a valid legal process.",
        "Professional advisers (lawyers, auditors, insurers) bound by confidentiality.",
      ],
    },
    {
      id: "storage-security",
      title: "5. Storage, security, and retention",
      paragraphs: [
        "Sensitive personal fields such as name, email, and phone are encrypted at rest. We use industry-standard safeguards including HTTPS, access controls, and audit logging for administrative actions.",
        "Data may be stored on secure cloud infrastructure. Where data is processed outside Pakistan, we apply appropriate contractual and technical safeguards.",
        "We retain data for as long as your account is active and as required for medical record-keeping, tax, and legal obligations. You may request deletion subject to limits described in Section 8.",
      ],
    },
    {
      id: "cookies",
      title: "6. Cookies and similar technologies",
      paragraphs: [
        "We use essential cookies for authentication and session management. Optional analytics or preference cookies, if introduced, will be disclosed in an updated version of this policy.",
        "You can control cookies through your browser settings. Disabling essential cookies may prevent you from logging in or booking.",
      ],
    },
    {
      id: "children",
      title: "7. Children and guardians",
      paragraphs: [
        "Our services are intended for users aged 18 and over. A parent or legal guardian may create and manage an account on behalf of a minor where permitted by law, and must provide consent for any telemedicine or home-care service involving a child.",
      ],
    },
    {
      id: "your-rights",
      title: "8. Your rights",
      paragraphs: ["Subject to applicable law, you may:"],
      bullets: [
        "Access a copy of personal data we hold about you.",
        "Request correction of inaccurate information.",
        "Request deletion of your account and associated data, except where retention is legally required (e.g. financial records, unresolved disputes).",
        "Object to or restrict certain processing.",
        "Lodge a complaint with us at the contact below.",
      ],
    },
    {
      id: "contact",
      title: "9. Contact us",
      paragraphs: [
        `For privacy questions, data access, or deletion requests, email ${CONTACT}. We aim to respond within 15 business days.`,
        "This policy is governed by the laws of Pakistan. We may update this policy from time to time; material changes will be posted on this page with a revised date.",
      ],
    },
  ],
};

const terms: LegalDocument = {
  title: "Terms of Service",
  lastUpdated: LAST_UPDATED,
  intro:
    "These Terms of Service (“Terms”) govern your access to and use of the ZindagiCare platform, including online consultations, Sunday free consults, in-house medical services, messaging, and related features. By creating an account or using our services, you agree to these Terms.",
  sections: [
    {
      id: "about-platform",
      title: "1. About ZindagiCare",
      paragraphs: [
        "ZindagiCare is a technology platform that connects patients with independent, PMDC-verified doctors and licensed care providers. We are a marketplace and coordination service — not a hospital, clinic, or employer of every provider listed unless explicitly stated.",
        "Medical advice, diagnosis, and treatment are provided by the independent professional you book. ZindagiCare does not practice medicine.",
      ],
    },
    {
      id: "eligibility",
      title: "2. Eligibility and accounts",
      paragraphs: ["To use ZindagiCare you must:"],
      bullets: [
        "Be at least 18 years old, or use the platform under a guardian’s supervision where permitted.",
        "Provide accurate registration information and keep your credentials secure.",
        "Not share your account or use the platform for unlawful, abusive, or fraudulent purposes.",
        "Accept our Privacy Policy and, where applicable, Telemedicine Consent before receiving care.",
      ],
    },
    {
      id: "services",
      title: "3. Services we offer",
      paragraphs: ["Current services include:"],
      bullets: [
        "Paid online video consultations with listed doctors.",
        "Free 10-minute Sunday video consults (subject to availability and fair-use limits).",
        "In-house medical visits by licensed doctors and nurses in supported areas.",
        "Secure messaging related to bookings and care coordination.",
        "Future features (such as medicine delivery) may be added with updated Terms.",
      ],
    },
    {
      id: "provider-relationship",
      title: "4. Relationship with providers",
      paragraphs: [
        "Doctors and nurses on ZindagiCare are independent professionals responsible for their clinical judgments, licensing, and compliance with PMDC, Pakistan Nursing Council, and applicable regulations.",
        "We verify credentials before listing but do not guarantee clinical outcomes. You choose your provider based on profiles, ratings, and availability.",
      ],
    },
    {
      id: "bookings-payments",
      title: "5. Bookings, fees, and payments",
      paragraphs: [
        "Displayed fees are set by providers or platform policies and shown before you confirm a booking. Payments are processed through approved payment partners in PKR.",
        "A booking is confirmed only after successful payment (for paid services) or successful slot confirmation (for free Sunday consults). You are responsible for joining video sessions on time and providing accurate contact and address details for home visits.",
      ],
    },
    {
      id: "cancellations",
      title: "6. Cancellations and refunds",
      paragraphs: [
        "Cancellation and refund rules are set out in our Refund & Cancellation Policy, incorporated into these Terms by reference.",
      ],
    },
    {
      id: "telemedicine-limits",
      title: "7. Telemedicine limitations",
      paragraphs: [
        "Remote consultations have inherent limits. Providers may advise in-person examination, emergency care, or laboratory tests where appropriate.",
        "ZindagiCare is not for medical emergencies. If you or someone else is in immediate danger, call emergency services (e.g. 1122) or go to the nearest hospital.",
        "See our Telemedicine Consent for full details on remote care.",
      ],
    },
    {
      id: "home-visit-environment",
      title: "8. Home visit environment and allergies",
      paragraphs: [
        "When you book an in-house (home) medical visit, you are responsible for ensuring that the visit location is reasonably safe for the attending doctor or care provider, and for disclosing any known environmental risks that may affect them. This includes, without limitation, pets, dust, mould, smoke, strong chemicals, fragrances, food allergens, or other substances that may trigger an allergic reaction or sensitivity.",
        "ZindagiCare is a technology platform that coordinates visits between patients and independent providers. To the fullest extent permitted by law, ZindagiCare is not responsible for any allergic reaction, sensitivity, illness, or related harm that a doctor, nurse, or other care provider may experience as a result of allergens or environmental conditions present at your home or any other visit location you arrange.",
        "Any such risk arising from the premises remains with the patient (or the household occupying the premises) and the independent provider, not with ZindagiCare. If you are aware of significant allergen exposure at the visit location, you should inform the assigned provider in advance so they may take appropriate precautions or reschedule where necessary.",
      ],
    },
    {
      id: "acceptable-use",
      title: "9. Acceptable use",
      paragraphs: ["You agree not to:"],
      bullets: [
        "Harass providers, staff, or other users.",
        "Submit false medical information or impersonate others.",
        "Attempt to bypass payments, booking limits, or security controls.",
        "Scrape, reverse engineer, or overload our systems.",
        "Use the platform to obtain controlled substances improperly or for non-medical purposes.",
      ],
    },
    {
      id: "intellectual-property",
      title: "10. Intellectual property",
      paragraphs: [
        "ZindagiCare branding, software, and content are owned by us or our licensors. You receive a limited, non-exclusive licence to use the platform for personal healthcare coordination. Provider content remains theirs subject to licences needed to operate the service.",
      ],
    },
    {
      id: "disclaimers",
      title: "11. Disclaimers",
      paragraphs: [
        "The platform is provided “as is” to the fullest extent permitted by law. We do not warrant uninterrupted access, error-free operation, or that any provider will be available at a specific time.",
        "To the extent permitted by law, ZindagiCare is not liable for indirect, incidental, or consequential damages arising from use of the platform or provider services.",
      ],
    },
    {
      id: "limitation",
      title: "12. Limitation of liability",
      paragraphs: [
        "Our total liability to you for claims relating to the platform (excluding liability that cannot be excluded under Pakistani law) is limited to the fees you paid to ZindagiCare for the specific booking giving rise to the claim in the three months before the claim.",
        "Nothing in these Terms limits liability for fraud, wilful misconduct, or death or personal injury caused by our negligence where such limitation is prohibited by law.",
      ],
    },
    {
      id: "termination",
      title: "13. Suspension and termination",
      paragraphs: [
        "We may suspend or terminate accounts that violate these Terms, pose a safety risk, or are required by law. You may close your account by contacting support. Provisions that by nature should survive (payment obligations, disclaimers, dispute resolution) will survive termination.",
      ],
    },
    {
      id: "governing-law",
      title: "14. Governing law and disputes",
      paragraphs: [
        "These Terms are governed by the laws of Pakistan. Disputes should first be raised with us at support. If unresolved, disputes shall be subject to the exclusive jurisdiction of the courts of Lahore, Pakistan, unless mandatory consumer protection law provides otherwise.",
      ],
    },
    {
      id: "changes",
      title: "15. Changes to Terms",
      paragraphs: [
        "We may update these Terms. Continued use after the effective date of changes constitutes acceptance. Material changes will be communicated via the platform or email where appropriate.",
      ],
    },
    {
      id: "contact",
      title: "16. Contact",
      paragraphs: [`Questions about these Terms: ${CONTACT}.`],
    },
  ],
};

const refundPolicy: LegalDocument = {
  title: "Refund & Cancellation Policy",
  lastUpdated: LAST_UPDATED,
  intro:
    "This policy explains how cancellations, rescheduling, no-shows, and refunds work for ZindagiCare bookings. It applies to paid online consultations and in-house medical visits unless a specific promotion states otherwise.",
  sections: [
    {
      id: "general",
      title: "1. General principles",
      paragraphs: [
        "All times are in Pakistan Standard Time (Asia/Karachi). Refunds, when approved, are returned to the original payment method where possible and may take 5–10 business days depending on JazzCash, EasyPaisa, or bank processing.",
      ],
    },
    {
      id: "paid-consults",
      title: "2. Paid online consultations",
      paragraphs: ["For standard paid video consultations:"],
      bullets: [
        "Patient cancels 24+ hours before scheduled start: full refund of consultation fee (platform/processing fees may be deducted if disclosed at checkout).",
        "Patient cancels less than 24 hours before start: no refund unless we or the doctor agree otherwise (e.g. documented emergency).",
        "Doctor cancels or fails to join within 15 minutes of scheduled start: full refund or free reschedule at patient’s choice.",
        "Technical failure on our or the video provider’s side preventing the consult: full refund or reschedule.",
        "Patient no-show (does not join within 15 minutes): no refund.",
      ],
    },
    {
      id: "sunday-free",
      title: "3. Sunday free consults",
      paragraphs: [
        "Sunday consults are free (Rs. 0). They are limited to one free slot per patient per week where stated. Abuse of free slots (multiple accounts, repeated no-shows) may result in booking restrictions without notice.",
        "Because no payment is collected, monetary refunds do not apply. Missed free slots may be rebooked subject to availability.",
      ],
    },
    {
      id: "home-visits",
      title: "4. In-house medical visits",
      paragraphs: ["For home visits:"],
      bullets: [
        "Patient cancels 24+ hours before scheduled arrival: full refund of visit fee.",
        "Patient cancels less than 24 hours before arrival: up to 50% cancellation charge may apply to cover dispatch and provider time.",
        "Provider cannot attend due to safety, traffic, or operational reasons: full refund or reschedule.",
        "Visit cannot proceed due to incorrect address, denied entry, or unsafe conditions at location: no refund.",
        "Partial services rendered: refunds assessed case-by-case; consumables or completed procedures may not be refundable.",
      ],
    },
    {
      id: "how-to-request",
      title: "5. How to request a refund",
      paragraphs: [
        `Contact ${CONTACT} within 7 days of the appointment with your booking ID, reason, and any supporting details. We will review with the provider and payment records and respond within 5 business days.`,
      ],
    },
    {
      id: "chargebacks",
      title: "6. Chargebacks and disputes",
      paragraphs: [
        "Please contact us before initiating a payment dispute with your wallet or bank. Unfounded chargebacks may lead to account suspension.",
      ],
    },
  ],
};

const telemedicineConsent: LegalDocument = {
  title: "Telemedicine Consent",
  lastUpdated: LAST_UPDATED,
  intro:
    "Before receiving an online video consultation through ZindagiCare, please read and accept this Telemedicine Consent. It describes the nature, benefits, and limits of remote medical care.",
  sections: [
    {
      id: "nature",
      title: "1. Nature of telemedicine",
      paragraphs: [
        "Telemedicine allows you to consult a licensed doctor via secure video when an in-person visit is not required or available. The doctor may ask about your symptoms, review information you provide, and offer advice, prescriptions where legally permitted, or referrals for in-person care or tests.",
      ],
    },
    {
      id: "benefits-risks",
      title: "2. Benefits and limitations",
      paragraphs: ["Benefits may include convenient access, reduced travel, and timely advice. Limitations include:"],
      bullets: [
        "The doctor cannot perform a full physical examination remotely.",
        "Connection quality, lighting, or device issues may affect the consult.",
        "Some conditions require emergency or in-person care that telemedicine cannot replace.",
        "Prescriptions may be limited by law, drug schedule, or clinical judgment.",
      ],
    },
    {
      id: "emergency",
      title: "3. Not for emergencies",
      paragraphs: [
        "Do not use ZindagiCare for emergencies such as chest pain, severe breathing difficulty, stroke symptoms, major trauma, or suicidal crisis. Call 1122 or go to the nearest emergency department immediately.",
      ],
    },
    {
      id: "privacy-records",
      title: "4. Privacy and medical records",
      paragraphs: [
        "Information you share during a telemedicine session may be recorded in your appointment record and shared with the treating provider. We apply encryption and access controls as described in our Privacy Policy.",
        "Unless we explicitly notify you and obtain separate consent, video consultations are not recorded by ZindagiCare.",
      ],
    },
    {
      id: "your-responsibilities",
      title: "5. Your responsibilities",
      paragraphs: ["You agree to:"],
      bullets: [
        "Provide accurate medical history and current medications.",
        "Use a private, well-lit location and a stable internet connection.",
        "Join at the scheduled time or cancel according to our Refund Policy.",
        "Follow up in person if the doctor recommends physical examination, tests, or emergency care.",
        "Ensure a guardian is present and consents when the patient is a minor.",
      ],
    },
    {
      id: "consent",
      title: "6. Informed consent",
      paragraphs: [
        "By booking or joining a video consultation on ZindagiCare, you confirm that you have read this Telemedicine Consent, understand its limitations, and consent to receive care via telemedicine from the provider you selected.",
        "You may withdraw consent before the session begins by cancelling the booking. During a session, you may end the call at any time; the provider will document the encounter accordingly.",
      ],
    },
    {
      id: "contact",
      title: "7. Questions",
      paragraphs: [`Clinical or consent questions: ${CONTACT}.`],
    },
  ],
};

export const legalDocumentsEn = {
  privacy,
  terms,
  refundPolicy,
  telemedicineConsent,
} satisfies Record<LegalDocumentSlug, LegalDocument>;
