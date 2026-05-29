import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";

const faqs = [
  {
    q: "What services does ZindagiCare offer at launch?",
    a: "We offer three services in Lahore: secure online video consultations with PMDC-verified doctors, free 10-minute Sunday video consults (Rs. 0), and in-house medical services — licensed doctors and nurses who visit you at home for check-ups, nursing, IV therapy, and related care.",
  },
  {
    q: "What is Sunday Free Consult?",
    a: "It is a free 10-minute video consultation with a PMDC-verified doctor every Sunday — no consultation fee. You book one slot per doctor per week on ZindagiCare, join the secure video call at your chosen time from home, and booking usually opens 7 days before that Sunday (Pakistan time).",
  },
  {
    q: "How does online consultation work?",
    a: "Choose a doctor, book a video slot, and join a private HD call on ZindagiCare. Share symptoms and reports in chat and receive a digital prescription when appropriate.",
  },
  {
    q: "Are doctors PMDC verified?",
    a: "Yes. We verify PMDC registration and review credentials before listing any doctor on ZindagiCare.",
  },
  {
    q: "How do I pay for in-house medical services?",
    a: "Pay securely via JazzCash, EasyPaisa, or card. You'll see the total before confirming your in-house visit.",
  },
];

export function FaqSection() {
  return (
    <PageSection variant="brand" spacing="lg" innerClassName="mx-auto max-w-3xl">
      <SectionHeader
        eyebrow="FAQ"
        title="Frequently asked questions"
        align="center"
      />
      <dl className="mt-8 space-y-3 sm:mt-12 sm:space-y-4">
        {faqs.map((faq) => (
          <div
            key={faq.q}
            className={`p-6 ${surfaceCardInteractive}`}
          >
            <dt className="font-display text-base font-semibold text-foreground">
              {faq.q}
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-slate-600">{faq.a}</dd>
          </div>
        ))}
      </dl>
    </PageSection>
  );
}
