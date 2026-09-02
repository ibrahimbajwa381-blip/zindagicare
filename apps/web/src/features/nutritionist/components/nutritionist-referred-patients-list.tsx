import type { NutritionistReferredPatientRow } from "@/server/services/nutritionist-referral.service";

export function NutritionistReferredPatientsList({
  patients,
}: {
  patients: NutritionistReferredPatientRow[];
}) {
  if (!patients.length) {
    return (
      <p className="rounded-2xl border border-slate-200/80 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
        No referred patients yet. Share your link to start earning the bonus
        share.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {patients.map((patient) => (
        <li
          key={patient.id}
          className="flex items-center justify-between gap-4 px-5 py-3"
        >
          <p className="text-sm font-medium text-slate-900">{patient.name}</p>
          <p className="text-xs text-slate-500">
            Joined{" "}
            {new Date(patient.joinedAt).toLocaleDateString("en-PK", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}
