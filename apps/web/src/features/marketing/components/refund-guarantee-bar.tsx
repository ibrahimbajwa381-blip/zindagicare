import { Headphones, Lock, ShieldCheck, Undo2 } from "lucide-react";
import { getServerTranslations } from "@/i18n/server";

export async function RefundGuaranteeBar() {
  const { t } = await getServerTranslations();

  const items = [
    {
      icon: ShieldCheck,
      label: t.refundGuarantee.verifiedDoctors,
      description: t.refundGuarantee.verifiedDoctorsDesc,
    },
    {
      icon: Lock,
      label: t.refundGuarantee.securePayment,
      description: t.refundGuarantee.securePaymentDesc,
    },
    {
      icon: Undo2,
      label: t.refundGuarantee.fullRefund,
      description: t.refundGuarantee.fullRefundDesc,
    },
    {
      icon: Headphones,
      label: t.refundGuarantee.support,
      description: t.refundGuarantee.supportDesc,
    },
  ];

  return (
    <section className="bg-brand-dark">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-10">
        {items.map(({ icon: Icon, label, description }) => (
          <div key={label} className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white" strokeWidth={2} aria-hidden />
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/70">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
