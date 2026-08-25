import Link from "next/link";
import {
  ArrowDownToLine,
  Banknote,
  ChevronRight,
  CircleDollarSign,
  Stethoscope,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DoctorEmptyState,
  DoctorListCard,
  formatDateTime,
} from "@/features/doctor/components/doctor-workspace-panels";
import type {
  DoctorConsultCounts,
  DoctorEarningsDetail,
} from "@/server/services/doctor-dashboard.service";

function formatCurrency(amount: number, currency = "PKR") {
  return `${currency} ${amount.toLocaleString("en-PK")}`;
}

function formatConsultType(type: string) {
  switch (type) {
    case "online":
      return "Online consult";
    case "clinic":
      return "Clinic visit";
    case "urgent_online":
      return "Urgent consult";
    case "doctor_visit":
      return "In-house visit";
    default:
      return type.replace(/_/g, " ");
  }
}

function formatWithdrawalStatus(status: string) {
  switch (status) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

type Props = {
  earnings: DoctorEarningsDetail;
};

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "emerald" | "amber" | "sky";
};

function StatCard({ label, value, hint, accent = "default" }: StatCardProps) {
  const accentClasses = {
    default: "border-slate-200/80 bg-white",
    emerald: "border-emerald-200/80 bg-emerald-50/50",
    amber: "border-amber-200/80 bg-amber-50/50",
    sky: "border-sky-200/80 bg-sky-50/50",
  } as const;

  const labelClasses = {
    default: "text-slate-500",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    sky: "text-sky-700",
  } as const;

  const valueClasses = {
    default: "text-slate-900",
    emerald: "text-emerald-900",
    amber: "text-amber-900",
    sky: "text-sky-900",
  } as const;

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${accentClasses[accent]}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${labelClasses[accent]}`}>
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${valueClasses[accent]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

type SectionProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
};

function EarningsSection({ icon: Icon, title, description, children }: SectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ConsultBreakdownGrid({
  label,
  counts,
}: {
  label: string;
  counts: DoctorConsultCounts;
}) {
  const rows = [
    { label: "Online", value: counts.online },
    { label: "Clinic", value: counts.clinic },
    { label: "Urgent", value: counts.urgent },
    { label: "In-house", value: counts.homeVisit },
  ];

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{counts.total}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg bg-white px-3 py-2">
            <dt className="text-xs text-slate-500">{row.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DoctorEarningsPanel({ earnings }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-sm text-slate-600">
        You earn{" "}
        <span className="font-semibold text-slate-900">
          {earnings.onlineCommissionPercent}%
        </span>{" "}
        on online, clinic, and urgent consults and{" "}
        <span className="font-semibold text-slate-900">
          {earnings.homeVisitCommissionPercent}%
        </span>{" "}
        on in-house visits. Amounts below are what is credited to you.
      </div>

      <EarningsSection
        icon={TrendingUp}
        title="Your earnings"
        description="Amounts credited to you from completed paid consultations."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Your earnings (all time)"
            value={formatCurrency(earnings.totalEarnings)}
            hint="Amount credited to you"
          />
          <StatCard
            label="Your earnings (this month)"
            value={formatCurrency(earnings.earningsThisMonth)}
            accent="emerald"
          />
        </div>
      </EarningsSection>

      <EarningsSection
        icon={Stethoscope}
        title="Completed consultations"
        description="Paid services you have finished on ZindagiCare."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ConsultBreakdownGrid label="All time" counts={earnings.completedConsults} />
          <ConsultBreakdownGrid
            label="This month"
            counts={earnings.completedConsultsThisMonth}
          />
        </div>
      </EarningsSection>

      <EarningsSection
        icon={Wallet}
        title="Withdrawals"
        description="Available balance and payout history."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Available balance"
            value={formatCurrency(earnings.availableBalance)}
            hint="Ready to withdraw"
            accent="sky"
          />
          <StatCard
            label="Total withdrawn"
            value={formatCurrency(earnings.totalWithdrawn)}
          />
          <StatCard
            label="Pending withdrawal"
            value={formatCurrency(earnings.pendingWithdrawal)}
          />
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            <ArrowDownToLine className="h-4 w-4 text-brand" />
            Payout requests
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Payouts are sent by ZindagiCare admin to your registered bank account. Keep your
            bank details up to date below so payments reach you.
          </p>
        </div>

        {earnings.withdrawals.length === 0 ? (
          <div className="mt-4">
            <DoctorEmptyState message="No payouts yet. Once admin pays you, it will appear here with a receipt." />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {earnings.withdrawals.map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <DoctorListCard
                  title={formatCurrency(withdrawal.amount, withdrawal.currency)}
                  subtitle={formatWithdrawalStatus(withdrawal.status)}
                  meta={`Paid ${formatDateTime(withdrawal.requestedAt)}`}
                />
                {withdrawal.receiptUrl && (
                  <a
                    href={withdrawal.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-medium text-brand hover:underline"
                  >
                    View receipt
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </EarningsSection>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <CircleDollarSign className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Earning history</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Your credited amount for each completed consultation.
              </p>
            </div>
          </div>
        </div>
        {earnings.transactions.length === 0 ? (
          <DoctorEmptyState message="No paid services completed yet. Earnings appear here after patients complete bookings or home visits." />
        ) : (
          <div className="divide-y divide-slate-100">
            {earnings.transactions.map((tx) => (
              <div key={tx.id} className="p-4 sm:p-5">
                <DoctorListCard
                  title={tx.patient.name}
                  subtitle={formatConsultType(tx.type)}
                  meta={`Completed ${formatDateTime(tx.completedAt)}`}
                  badge={formatCurrency(tx.amount, tx.currency)}
                />
                {tx.isReferralBonus && (
                  <Badge
                    variant="outline"
                    className="mt-2 border-brand/30 bg-brand/[0.06] text-brand"
                  >
                    Referral bonus applied ({tx.commissionPercent}%)
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type DoctorEarningsSummaryCardProps = {
  totalEarnings: number;
  earningsThisMonth: number;
  availableBalance?: number;
};

export function DoctorEarningsSummaryCard({
  totalEarnings,
  earningsThisMonth,
  availableBalance,
}: DoctorEarningsSummaryCardProps) {
  return (
    <Link
      href="/doctor/earnings"
      className="group block rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <Banknote className="h-3.5 w-3.5" />
            Earnings
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(totalEarnings)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {formatCurrency(earningsThisMonth)} this month
          </p>
          {typeof availableBalance === "number" && (
            <p className="mt-1 text-xs text-emerald-700">
              {formatCurrency(availableBalance)} available to withdraw
            </p>
          )}
        </div>
        <Badge variant="outline" className="border-emerald-200 text-emerald-800">
          View details
        </Badge>
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 opacity-0 transition group-hover:opacity-100">
        Open earnings
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
