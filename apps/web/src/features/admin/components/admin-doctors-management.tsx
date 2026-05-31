"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatDayOfWeek } from "@/features/doctor/types";

type Doctor = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  pmdcNumber?: string;
  specialties: string[];
  verificationStatus: string;
  isListed: boolean;
  isActive: boolean;
  sundayConsultEnabled: boolean;
  weeklyAvailability: { dayOfWeek: number; startTimeLocal: string; endTimeLocal: string }[];
};

const DAYS = [1, 2, 3, 4, 5, 6, 0];

export function AdminDoctorsManagement() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button type="button" variant="outline" onClick={() => load()}>
          Search
        </Button>
        <Button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add doctor manually"}
        </Button>
      </div>

      {showForm && (
        <Card className={surfaceCard}>
          <CardHeader>
            <CardTitle className="text-base">Add doctor</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createDoctor} className="grid gap-3 sm:grid-cols-2">
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
                placeholder="Phone (optional)"
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
                placeholder="Specializations (comma-separated)"
                value={form.specialties}
                onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                required
              />
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.sundayConsultEnabled}
                  onChange={(e) =>
                    setForm({ ...form, sundayConsultEnabled: e.target.checked })
                  }
                />
                Enable Sunday free consult
              </label>
              <Button type="submit" disabled={pending === "create"}>
                Create doctor
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading doctors…</p>
      ) : (
        <div className="space-y-4">
          {doctors.map((doc) => (
            <Card key={doc.id} className={surfaceCard}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{doc.name}</p>
                    <p className="text-sm text-slate-500">
                      {doc.email} {doc.phone ? `· ${doc.phone}` : ""}
                    </p>
                    <p className="text-sm text-slate-500">
                      PMDC: {doc.pmdcNumber ?? "—"} ·{" "}
                      {doc.specialties.join(", ") || "No specialty"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={doc.verificationStatus === "approved" ? "default" : "outline"}>
                      {doc.verificationStatus}
                    </Badge>
                    {doc.isListed ? (
                      <Badge>Listed</Badge>
                    ) : (
                      <Badge variant="outline">Unlisted</Badge>
                    )}
                    {!doc.isActive && <Badge variant="outline">Inactive</Badge>}
                  </div>
                </div>

                {doc.weeklyAvailability.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Schedule:{" "}
                    {doc.weeklyAvailability
                      .map(
                        (a) =>
                          `${formatDayOfWeek(a.dayOfWeek)} ${a.startTimeLocal}–${a.endTimeLocal}`,
                      )
                      .join(", ")}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending === doc.id}
                    onClick={() => updateDoctor(doc.id, { isListed: !doc.isListed })}
                  >
                    {doc.isListed ? "Deactivate listing" : "Activate listing"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending === doc.id}
                    onClick={() => updateDoctor(doc.id, { isActive: !doc.isActive })}
                  >
                    {doc.isActive ? "Deactivate account" : "Activate account"}
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
                    Set Mon–Sat 9–5 schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {doctors.length === 0 && (
            <p className="text-sm text-slate-500">No doctors found.</p>
          )}
        </div>
      )}
    </div>
  );
}
