import Link from "next/link";
import { CalendarCheck, ChevronRight, Wallet } from "lucide-react";
import { PHYSIOTHERAPY_HOME_VISIT_SPLIT as SPLIT } from "@zindagi/shared";

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

type Props = {
  /** Omit before approval — the card then only explains the split. */
  earnings?: { thisMonth: number; total: number };
};

/** Explains the 70/30 split and Sunday payouts, with the physio's earnings when available. */
export function PhysiotherapistEarningsSplitCard({ earnings }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
      <div
        className={
          earnings
            ? "grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
            : "p-5 sm:p-6"
        }
      >
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <Wallet className="h-3.5 w-3.5" />
            How you get paid
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            You keep {SPLIT.physiotherapistPercent}% of every visit fee
          </p>
          <p className="mt-1 text-sm text-slate-600">
            ZindagiCare keeps {SPLIT.platformPercent}%. On a {formatCurrency(SPLIT.patientPays)} visit
            you earn {formatCurrency(SPLIT.physiotherapistEarns)}.
          </p>
          <p className="mt-3 flex items-start gap-2 text-sm font-medium text-emerald-900">
            <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            Your earnings are added to your bank account every Sunday.
          </p>
        </div>

        {earnings && (
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-emerald-100 bg-white/80 p-4">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-slate-500">This month</dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                  {formatCurrency(earnings.thisMonth)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">All time</dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                  {formatCurrency(earnings.total)}
                </dd>
              </div>
            </dl>
            <Link
              href="/physiotherapist/earnings"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              View earnings & payouts
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
