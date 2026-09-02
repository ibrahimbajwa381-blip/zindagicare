"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AdminDoctorAvatar } from "@/features/admin/components/admin-doctor-avatar";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { cn } from "@zindagi/shared";

function CopyableText({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard access can be blocked, no fallback needed here
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className={cn(
        "inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-slate-100 transition-colors",
        className,
      )}
    >
      <span>{value}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-slate-400" />
      )}
    </button>
  );
}

type PendingDoctor = {
  _id: string;
  pmdcNumber?: string;
  specialties?: string[];
  verificationSubmittedAt?: string;
  userId?: {
    name?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
  };
};

export function AdminDoctorQueue() {
  const [doctors, setDoctors] = useState<PendingDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function load() {
    setLoading(true);
    setError(undefined);
    const res = await fetch("/api/v1/admin/doctors/pending");
    const json = await res.json();
    setLoading(false);
    if (!json.success) {
      setError(json?.error?.message ?? "Failed to load queue");
      return;
    }
    setDoctors(json.data?.doctors ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <LoadingScreen message="Loading pending applications…" size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!doctors.length) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
        <p className="font-medium text-slate-900">No pending applications</p>
        <p className="mt-2 text-sm text-slate-500">
          Doctors appear here after they submit their verification form with PMDC documents.
        </p>
      </div>
    );
  }

  const submitted = doctors.filter((d) => d.verificationSubmittedAt).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">In queue</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{doctors.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ready for review</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{submitted}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Incomplete</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {doctors.length - submitted}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Doctor</th>
                <th className="px-5 py-4">Phone</th>
                <th className="px-5 py-4">Specialty</th>
                <th className="px-5 py-4">PMDC</th>
                <th className="px-5 py-4">Submitted</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.map((d) => {
                const name = d.userId?.name ?? "Doctor";
                const avatar = resolveDoctorPortrait(name, d.userId?.avatarUrl);
                return (
                  <tr key={d._id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <AdminDoctorAvatar name={name} avatarUrl={avatar} size="md" />
                        <div>
                          <p className="font-semibold text-slate-900">{name}</p>
                          <p className="text-xs text-slate-500">
                            {d.userId?.email ?? d.userId?.phone ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {d.userId?.phone ? (
                        <CopyableText value={d.userId.phone} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(d.specialties ?? []).slice(0, 2).map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">{d.pmdcNumber ?? "—"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {d.verificationSubmittedAt
                        ? new Date(d.verificationSubmittedAt).toLocaleDateString("en-PK", {
                            dateStyle: "medium",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      {d.verificationSubmittedAt ? (
                        <Badge>Ready for review</Badge>
                      ) : (
                        <Badge variant="outline">Incomplete</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button size="sm" asChild>
                        <Link href={`/admin/doctors/review/${d._id}`}>
                          <Eye className="h-4 w-4" />
                          View application
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
