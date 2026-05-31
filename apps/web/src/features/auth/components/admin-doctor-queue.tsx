"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoctorProfileDetail } from "@/features/doctor/components/doctor-profile-section";
import type { DoctorProfileDto } from "@/features/doctor/types";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DoctorProfileDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);

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

  async function loadDetail(doctorProfileId: string) {
    setSelectedId(doctorProfileId);
    setDetailLoading(true);
    const res = await fetch(`/api/v1/admin/doctors/${doctorProfileId}`);
    const json = await res.json();
    setDetailLoading(false);
    if (res.ok) {
      setDetail(json.data);
    } else {
      setDetail(null);
    }
  }

  async function decide(doctorProfileId: string, action: "approve" | "reject") {
    let rejectionReason: string | undefined;
    if (action === "reject") {
      rejectionReason = window.prompt("Rejection reason for the doctor:") ?? undefined;
      if (!rejectionReason) return;
    }

    setActionPending(true);
    const res = await fetch("/api/v1/admin/doctors/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorProfileId, action, rejectionReason }),
    });
    setActionPending(false);

    if (!res.ok) {
      alert("Action failed");
      return;
    }

    setSelectedId(null);
    setDetail(null);
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading pending doctors…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!doctors.length) {
    return <p className="text-sm text-slate-500">No pending verifications.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <ul className={`divide-y divide-brand-light/20 overflow-hidden lg:col-span-2 ${surfaceCard}`}>
        {doctors.map((d) => (
          <li key={d._id}>
            <button
              type="button"
              onClick={() => loadDetail(d._id)}
              className={`flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-white/90 ${
                selectedId === d._id ? "bg-brand-light/10" : ""
              }`}
            >
              <p className="font-medium text-slate-900">{d.userId?.name ?? "Doctor"}</p>
              <p className="text-sm text-slate-600">
                {d.userId?.email ?? d.userId?.phone} · PMDC {d.pmdcNumber}
              </p>
              <div className="flex flex-wrap gap-1">
                {(d.specialties ?? []).map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
              {d.verificationSubmittedAt && (
                <p className="text-xs text-slate-500">
                  Submitted{" "}
                  {new Date(d.verificationSubmittedAt).toLocaleDateString("en-PK")}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>

      <Card className={`lg:col-span-3 ${surfaceCard}`}>
        <CardHeader>
          <CardTitle className="text-base">Application review</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedId && (
            <p className="text-sm text-slate-500">
              Select a doctor from the queue to review their full profile and documents.
            </p>
          )}
          {selectedId && detailLoading && (
            <p className="text-sm text-slate-500">Loading profile…</p>
          )}
          {selectedId && !detailLoading && detail && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{detail.user.name}</h3>
                <p className="text-sm text-slate-600">
                  {detail.user.email ?? detail.user.phone}
                </p>
              </div>

              <DoctorProfileDetail profile={detail} showDocuments />

              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <Button
                  onClick={() => decide(selectedId, "approve")}
                  disabled={actionPending}
                >
                  {actionPending ? "Processing…" : "Approve & activate profile"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => decide(selectedId, "reject")}
                  disabled={actionPending}
                >
                  Reject
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Approving will list the doctor publicly, enable Sunday consult slots if
                configured, and mark their onboarding complete.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
