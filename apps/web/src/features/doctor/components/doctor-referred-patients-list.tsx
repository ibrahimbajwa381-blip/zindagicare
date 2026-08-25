import { Users } from "lucide-react";
import type { ReferredPatientRow } from "@/server/services/doctor-referral.service";

export function DoctorReferredPatientsList({
  patients,
}: {
  patients: ReferredPatientRow[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Users className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Patients you referred</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Everyone who signed up through your link — the bonus applies for as long as
              they book with you.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {patients.length === 0 ? (
          <p className="text-sm text-slate-500">
            No patients yet — share your link to start earning the referral bonus.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {patients.map((patient) => (
              <li
                key={patient.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <span className="font-medium text-slate-900">{patient.name}</span>
                <span className="text-slate-500">
                  Joined {new Date(patient.joinedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
