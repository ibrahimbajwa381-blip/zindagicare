"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { surfaceCard } from "@/lib/ui/surfaces";

type PendingDoctor = {
  _id: string;
  pmdcNumber?: string;
  specialties?: string[];
  verificationSubmittedAt?: string;
  userId?: { name?: string; email?: string; phone?: string };
};

export function AdminDoctorQueue() {
  const [doctors, setDoctors] = useState<PendingDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function load() {
    setLoading(true);
    const res = await fetch("/api/v1/admin/doctors/pending");
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "Failed to load queue");
      return;
    }
    setDoctors(json.data?.doctors ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(doctorProfileId: string, action: "approve" | "reject") {
    let rejectionReason: string | undefined;
    if (action === "reject") {
      rejectionReason = window.prompt("Rejection reason for the doctor:") ?? undefined;
      if (!rejectionReason) return;
    }

    const res = await fetch("/api/v1/admin/doctors/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorProfileId, action, rejectionReason }),
    });

    if (!res.ok) {
      alert("Action failed");
      return;
    }
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading pending doctors…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!doctors.length) {
    return <p className="text-sm text-slate-500">No pending verifications.</p>;
  }

  return (
    <ul className={`divide-y divide-brand-light/20 overflow-hidden ${surfaceCard}`}>
      {doctors.map((d) => (
        <li
          key={d._id}
          className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/90 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium text-slate-900">{d.userId?.name ?? "Doctor"}</p>
            <p className="text-sm text-slate-600">
              {d.userId?.email ?? d.userId?.phone} · PMDC {d.pmdcNumber}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(d.specialties ?? []).map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide(d._id, "approve")}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide(d._id, "reject")}>
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
