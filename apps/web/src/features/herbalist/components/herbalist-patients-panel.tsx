import { Star } from "lucide-react";
import type { HerbalistPatientRow } from "@/server/services/herbalist-dashboard.service";

const OUTCOME_STYLES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  missed: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
  upcoming: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function HerbalistPatientsPanel({
  patients,
}: {
  patients: HerbalistPatientRow[];
}) {
  if (!patients.length) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">
          No patients yet. Patients appear here after their first consultation
          with you.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Last consult</th>
              <th className="px-5 py-3 font-medium">Outcome</th>
              <th className="px-5 py-3 text-right font-medium">Consults</th>
              <th className="px-5 py-3 text-right font-medium">Completed</th>
              <th className="px-5 py-3 font-medium">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-900">{patient.name}</p>
                  {patient.phone && (
                    <p className="text-xs text-slate-500">{patient.phone}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {formatDate(patient.lastVisitAt)}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      OUTCOME_STYLES[patient.lastOutcome] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {patient.lastOutcome.replace("_", " ")}
                  </span>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                  {patient.appointmentCount}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                  {patient.completedCount}
                </td>
                <td className="px-5 py-3">
                  {patient.review ? (
                    <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {patient.review.rating}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
