"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import {
  Eye,
  MoreHorizontal,
  Plus,
  Search,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminDoctorAvatar } from "@/features/admin/components/admin-doctor-avatar";
import { formatDayOfWeek } from "@/features/doctor/types";
import { cn } from "@zindagi/shared";

type Doctor = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  slug?: string;
  pmdcNumber?: string;
  specialties: string[];
  verificationStatus: string;
  isListed: boolean;
  isActive: boolean;
  sundayConsultEnabled: boolean;
  homeVisitEnabled: boolean;
  homeVisitFee: number;
  weeklyAvailability: { dayOfWeek: number; startTimeLocal: string; endTimeLocal: string }[];
};

const DAYS = [1, 2, 3, 4, 5, 6, 0];

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "approved"
      ? "bg-emerald-100 text-emerald-800"
      : status === "rejected"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", styles)}>
      {status}
    </span>
  );
}

export function AdminDoctorsManagement() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    pmdcNumber: "",
    specialties: "",
    sundayConsultEnabled: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/v1/admin/doctors/manage${q}`);
    const json = await res.json();
    if (json.success) setDoctors(json.data?.doctors ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: doctors.length,
      approved: doctors.filter((d) => d.verificationStatus === "approved").length,
      pending: doctors.filter((d) => d.verificationStatus === "pending").length,
      listed: doctors.filter((d) => d.isListed).length,
    }),
    [doctors],
  );

  const updateDoctor = async (id: string, patch: Record<string, unknown>) => {
    setPending(id);
    const res = await fetch(`/api/v1/admin/doctors/${id}/manage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setPending(null);
    if (res.ok) await load();
    else alert("Update failed");
  };

  const createDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending("create");
    const res = await fetch("/api/v1/admin/doctors/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        phone: form.phone || undefined,
        pmdcNumber: form.pmdcNumber,
        specialties: form.specialties.split(",").map((s) => s.trim()).filter(Boolean),
        sundayConsultEnabled: form.sundayConsultEnabled,
      }),
    });
    setPending(null);
    if (res.ok) {
      setShowForm(false);
      setForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        pmdcNumber: "",
        specialties: "",
        sundayConsultEnabled: false,
      });
      await load();
    } else {
      const json = await res.json();
      alert(json?.error?.message ?? "Failed to create doctor");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total doctors", value: stats.total },
          { label: "Approved", value: stats.approved },
          { label: "Pending review", value: stats.pending },
          { label: "Publicly listed", value: stats.listed },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => load()}>
            Search
          </Button>
          <Button type="button" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showForm ? "Cancel" : "Add doctor"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Add doctor manually</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createDoctor} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                placeholder="Password (default: Doctor@123)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                placeholder="PMDC ID"
                value={form.pmdcNumber}
                onChange={(e) => setForm({ ...form, pmdcNumber: e.target.value })}
                required
              />
              <Input
                placeholder="Specialties (comma-separated)"
                value={form.specialties}
                onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                required
              />
              <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
                <input
                  type="checkbox"
                  checked={form.sundayConsultEnabled}
                  onChange={(e) =>
                    setForm({ ...form, sundayConsultEnabled: e.target.checked })
                  }
                />
                Enable Sunday free consult
              </label>
              <Button type="submit" disabled={pending === "create"} className="w-fit">
                Create doctor
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading doctors…</div>
        ) : doctors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Stethoscope className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No doctors found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">Doctor</th>
                  <th className="px-5 py-4">Specialty</th>
                  <th className="px-5 py-4">PMDC</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Listing</th>
                  <th className="px-5 py-4">Services</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctors.map((doc) => (
                  <Fragment key={doc.id}>
                    <tr className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <AdminDoctorAvatar
                            name={doc.name}
                            avatarUrl={doc.avatarUrl}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{doc.name}</p>
                            <p className="truncate text-xs text-slate-500">
                              {doc.email ?? doc.phone ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex max-w-[180px] flex-wrap gap-1">
                          {doc.specialties.slice(0, 2).map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                          {doc.specialties.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{doc.specialties.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">
                        {doc.pmdcNumber ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={doc.verificationStatus} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant={doc.isListed ? "default" : "outline"}>
                            {doc.isListed ? "Listed" : "Unlisted"}
                          </Badge>
                          {!doc.isActive && (
                            <Badge variant="outline" className="w-fit text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {doc.sundayConsultEnabled && (
                            <Badge variant="secondary" className="text-xs">
                              Sunday
                            </Badge>
                          )}
                          {doc.homeVisitEnabled && (
                            <Badge variant="secondary" className="text-xs">
                              Home visit
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/doctors/review/${doc.id}`}>
                              <Eye className="h-4 w-4" />
                              Profile
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setExpandedId(expandedId === doc.id ? null : doc.id)
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === doc.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending === doc.id}
                              onClick={() => updateDoctor(doc.id, { isListed: !doc.isListed })}
                            >
                              {doc.isListed ? "Unlist" : "List publicly"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending === doc.id}
                              onClick={() => updateDoctor(doc.id, { isActive: !doc.isActive })}
                            >
                              {doc.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending === doc.id}
                              onClick={() =>
                                updateDoctor(doc.id, {
                                  sundayConsultEnabled: !doc.sundayConsultEnabled,
                                })
                              }
                            >
                              {doc.sundayConsultEnabled ? "Disable Sunday" : "Enable Sunday"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                pending === doc.id || doc.verificationStatus !== "approved"
                              }
                              onClick={() =>
                                updateDoctor(doc.id, {
                                  homeVisitEnabled: !doc.homeVisitEnabled,
                                })
                              }
                            >
                              {doc.homeVisitEnabled ? "Disable home visits" : "Enable home visits"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending === doc.id}
                              onClick={() => {
                                const availability = DAYS.map((day) => ({
                                  dayOfWeek: day,
                                  startTimeLocal: "09:00",
                                  endTimeLocal: "17:00",
                                }));
                                updateDoctor(doc.id, { weeklyAvailability: availability });
                              }}
                            >
                              Set 9–5 schedule
                            </Button>
                          </div>
                          {doc.weeklyAvailability.length > 0 && (
                            <p className="mt-3 text-xs text-slate-500">
                              Schedule:{" "}
                              {doc.weeklyAvailability
                                .map(
                                  (a) =>
                                    `${formatDayOfWeek(a.dayOfWeek)} ${a.startTimeLocal}–${a.endTimeLocal}`,
                                )
                                .join(", ")}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
