import { formatPkr } from "@/features/herbalist/types";
import type { HerbalistEarningsDetail } from "@/server/services/herbalist-dashboard.service";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function HerbalistEarningsPanel({
  earnings,
}: {
  earnings: HerbalistEarningsDetail;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Net earnings"
          value={formatPkr(earnings.totalEarnings)}
          hint={`${formatPkr(earnings.earningsThisMonth)} this month`}
        />
        <SummaryTile
          label="Gross revenue"
          value={formatPkr(earnings.totalGrossRevenue)}
          hint={`${formatPkr(earnings.grossRevenueThisMonth)} this month`}
        />
        <SummaryTile
          label="Available balance"
          value={formatPkr(earnings.availableBalance)}
          hint={`${formatPkr(earnings.totalWithdrawn)} paid out`}
        />
        <SummaryTile
          label="Your share"
          value={`${earnings.onlineCommissionPercent}%`}
          hint="Of each paid video consult"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Transactions</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {earnings.completedPaidConsults} paid consult
            {earnings.completedPaidConsults === 1 ? "" : "s"} of{" "}
            {earnings.completedConsults} completed
          </p>
        </div>
        {earnings.transactions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No paid consultations yet. Earnings appear here once a consult is
            completed and its payment is confirmed.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 text-right font-medium">Gross</th>
                  <th className="px-5 py-3 text-right font-medium">Commission</th>
                  <th className="px-5 py-3 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {earnings.transactions.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(row.completedAt)}
                    </td>
                    <td className="px-5 py-3 text-slate-900">
                      {row.patient.name}
                      {row.isReferralBonus && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Referral bonus
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                      {formatPkr(row.grossAmount)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-500">
                      {formatPkr(row.commissionAmount)} ({100 - row.commissionPercent}%)
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatPkr(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Payouts</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Disbursements recorded by the ZindagiCare finance team.
          </p>
        </div>
        {earnings.withdrawals.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No payouts recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {earnings.withdrawals.map((payout) => (
              <li
                key={payout.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {formatPkr(payout.amount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(payout.completedAt ?? payout.requestedAt)}
                  </p>
                </div>
                {payout.receiptUrl && (
                  <a
                    href={payout.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-brand underline underline-offset-2"
                  >
                    Receipt
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
