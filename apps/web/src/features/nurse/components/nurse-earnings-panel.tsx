import { ArrowDownToLine, CircleDollarSign, TrendingUp, Wallet } from "lucide-react";
import type { NurseEarningsDetail } from "@/server/services/nurse-finance.service";

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  cash: "Cash",
  other: "Other",
};

function StatCard({
  label,
  value,
  hint,
  accent = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "emerald" | "sky";
}) {
  const box = {
    default: "border-slate-200/80 bg-white",
    emerald: "border-emerald-200/80 bg-emerald-50/50",
    sky: "border-sky-200/80 bg-sky-50/50",
  }[accent];
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${box}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

export function NurseEarningsPanel({
  earnings,
}: {
  earnings: NurseEarningsDetail;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-sm text-slate-600">
        You keep{" "}
        <span className="font-semibold text-slate-900">{earnings.nursePercent}%</span>{" "}
        of every home-visit fee and ZindagiCare keeps{" "}
        <span className="font-semibold text-slate-900">{earnings.platformPercent}%</span>. Amounts
        below are what is credited to you.
        <br />
        <span className="mt-1 inline-block font-medium text-slate-700">
          Note: Your weekly earnings are added to your given bank account every Sunday.
        </span>
      </div>

      <Section
        icon={TrendingUp}
        title="Your earnings"
        description="Your share of completed home visits."
      >
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <StatCard
            label="Your earnings (all time)"
            value={formatCurrency(earnings.totalEarnings)}
            hint={`${earnings.completedVisits} completed visit${earnings.completedVisits === 1 ? "" : "s"}`}
          />
          <StatCard
            label="Your earnings (this month)"
            value={formatCurrency(earnings.earningsThisMonth)}
            hint={`${earnings.completedVisitsThisMonth} visit${earnings.completedVisitsThisMonth === 1 ? "" : "s"} this month`}
            accent="emerald"
          />
        </div>
      </Section>

      <Section icon={Wallet} title="Payouts" description="Balance due and payments sent to you.">
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Balance due"
              value={formatCurrency(earnings.availableBalance)}
              hint="Paid to you on the coming Sunday"
              accent="sky"
            />
            <StatCard label="Total paid to you" value={formatCurrency(earnings.totalPaidOut)} />
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 text-sm text-slate-600">
            <p className="flex items-center gap-2 font-medium text-emerald-900">
              <ArrowDownToLine className="h-4 w-4 text-emerald-700" />
              You get paid every Sunday
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              ZindagiCare admin sends your balance to your registered bank account every Sunday.
              Keep your bank details up to date below so payments reach you.
            </p>
          </div>

          {earnings.payouts.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              No payouts yet. Once admin pays you, it will appear here with a receipt.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {earnings.payouts.map((payout) => (
                <li
                  key={payout.id}
                  className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(payout.amount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Paid {formatDate(payout.paidAt)} ·{" "}
                      {METHOD_LABELS[payout.method] ?? payout.method}
                    </p>
                  </div>
                  {payout.receiptUrl && (
                    <a
                      href={payout.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs font-medium text-brand hover:underline"
                    >
                      View receipt
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section
        icon={CircleDollarSign}
        title="Earning history"
        description="Your credited amount for each completed visit."
      >
        {earnings.transactions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No completed visits yet. Earnings appear here after you complete home visits.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {earnings.transactions.map((tx) => (
              <li
                key={tx.visitId}
                className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{tx.patientName}</p>
                  <p className="text-xs text-slate-500">
                    Completed {formatDate(tx.completedAt)} · Visit fee{" "}
                    {formatCurrency(tx.grossAmount)} · ZindagiCare {formatCurrency(tx.platformFee)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-emerald-700">
                  +{formatCurrency(tx.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
