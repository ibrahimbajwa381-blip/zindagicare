import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DoctorEmptyState,
  DoctorListCard,
  formatDateTime,
} from "@/features/doctor/components/doctor-workspace-panels";
import type { DoctorEarningsDetail } from "@/server/services/doctor-dashboard.service";

function formatCurrency(amount: number, currency = "PKR") {
  return `${currency} ${amount.toLocaleString("en-PK")}`;
}

function formatConsultType(type: string) {
  switch (type) {
    case "online":
      return "Online consult";
    case "clinic":
      return "Clinic visit";
    default:
      return type.replace(/_/g, " ");
  }
}

type Props = {
  earnings: DoctorEarningsDetail;
};

export function DoctorEarningsPanel({ earnings }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total earnings
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(earnings.totalEarnings)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            This month
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">
            {formatCurrency(earnings.earningsThisMonth)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Paid consultations
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {earnings.completedPaidConsults}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Earning history</h2>
          <p className="mt-1 text-xs text-slate-500">
            Revenue from completed paid online and clinic consultations.
          </p>
        </div>
        {earnings.transactions.length === 0 ? (
          <DoctorEmptyState message="No paid consultations completed yet. Earnings appear here after patients complete bookings." />
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type DoctorEarningsSummaryCardProps = {
  totalEarnings: number;
  earningsThisMonth: number;
};

export function DoctorEarningsSummaryCard({
  totalEarnings,
  earningsThisMonth,
}: DoctorEarningsSummaryCardProps) {
  return (
    <Link
      href="/doctor/earnings"
      className="group block rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Earnings
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(totalEarnings)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {formatCurrency(earningsThisMonth)} this month
          </p>
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
