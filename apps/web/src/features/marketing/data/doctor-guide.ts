export const DOCTOR_GUIDE_VIDEO = {
  youtubeId: "hZO8d7-975Q",
  title: "ZindagiCare platform walkthrough",
  description:
    "A complete demo of ZindagiCare by Ibrahim Baja, founder and CEO of TechCognify and co-founder of ZindagiCare — covering home care, online consults, Sunday free care, urgent care, and the doctor workspace.",
} as const;

export const DOCTOR_GUIDE_FAQ = [
  {
    q: "What percentage do I earn?",
    a: "You keep 70% of the patient payment on online, clinic, and urgent consults, and 70% on in-house doctor visits. ZindagiCare retains 30% as the platform fee. Amounts shown in Earnings are already your 70% share.",
  },
  {
    q: "Can I set my own consultation fee?",
    a: "Yes. You set your own online consultation fee in Edit profile. Patients see that fee when they book you. Your 70% is calculated on whatever fee you set (and on the platform fee for urgent care and home visits).",
  },
  {
    q: "When do I get paid?",
    a: "Payouts are processed monthly to your registered bank account. Email info.zindagicare@gmail.com or WhatsApp us to request a payout or update bank details.",
  },
  {
    q: "Is Sunday free consult paid?",
    a: "No. Sunday free consultation is unpaid volunteer work. You choose whether to participate, set your Sunday hours and slot count, and can disable it at any time. Sunday visits do not include paid chat.",
  },
  {
    q: "Where does ZindagiCare operate?",
    a: "Online consultations, urgent care, and Sunday free consults are Pakistan-wide. In-house (home visit) doctor services are Lahore only in Phase 1.",
  },
  {
    q: "What documents do I need to join?",
    a: "Create a doctor account, then submit your PMDC registration number, CNIC, PMDC certificate, CNIC front and back, and degree certificate. Admin reviews your application before your profile goes live.",
  },
  {
    q: "What happens if I miss a consultation?",
    a: "If you do not join an online or Sunday consult within 15 minutes after it ends, it counts as a miss. Three misses in a calendar month trigger a warning. Five misses in a month restrict your account so patients can no longer book you until admin restores it.",
  },
  {
    q: "How do urgent care calls work?",
    a: "Admin assigns an available doctor. You should join the secure video session within 10 minutes. Enable urgent care alerts so you are notified even when the app is closed. You can issue an e-prescription during the call.",
  },
] as const;

export const DOCTOR_GUIDE_SCREENSHOTS = {
  overview: {
    src: "/for-doctors/overview.png",
    alt: "Doctor workspace overview — profile, stats, and practice performance",
    width: 1024,
    height: 524,
  },
  editProfile: {
    src: "/for-doctors/edit-profile.png",
    alt: "Edit profile — photo, specialty, bio, languages, and practice locations",
    width: 1024,
    height: 529,
  },
  availability: {
    src: "/for-doctors/availability.png",
    alt: "Weekly availability — set consultation hours and Sunday free consult toggle",
    width: 1024,
    height: 581,
  },
  earnings: {
    src: "/for-doctors/earnings.png",
    alt: "Earnings page showing 70% commission and monthly totals",
    width: 1024,
    height: 523,
  },
  messages: {
    src: "/for-doctors/messages.png",
    alt: "Patient messages — chat after paid consultations",
    width: 1024,
    height: 520,
  },
  patients: {
    src: "/for-doctors/patients.png",
    alt: "My patients — visit history, reviews, and messaging",
    width: 1024,
    height: 583,
  },
  requests: {
    src: "/for-doctors/consult-requests.png",
    alt: "Consult requests — active, completed, missed, and Sunday free appointments",
    width: 1024,
    height: 521,
  },
  urgent: {
    src: "/for-doctors/urgent-care.png",
    alt: "Urgent care queue — join assigned video consults within 10 minutes",
    width: 1024,
    height: 523,
  },
  sunday: {
    src: "/for-doctors/sunday-consult.png",
    alt: "Sunday free consult — set volunteer slots or disable participation",
    width: 1024,
    height: 525,
  },
  homeVisits: {
    src: "/for-doctors/home-visits.png",
    alt: "Home visits — assigned in-house requests with en route to completed status",
    width: 1024,
    height: 521,
  },
} as const;
