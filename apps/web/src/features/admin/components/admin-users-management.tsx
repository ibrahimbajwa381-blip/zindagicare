"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Shield, ShieldOff, UserPlus } from "lucide-react";
import { Roles, type Role } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/loading-screen";
import type {
  AdminGrantCandidate,
  AdminUserRow,
} from "@/server/services/admin-users.service";
import { cn } from "@zindagi/shared";

const ROLE_LABELS: Record<Role, string> = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Admin",
  super_admin: "Super admin",
  rider: "Rider",
  nurse: "Nurse",
  physiotherapist: "Physiotherapist",
  herbalist: "Herbalist",
  nutritionist: "Nutritionist",
  lab: "Lab / Healthcare Professional",
  other: "Other",
};

function formatOtherRoles(roles: Role[]): string {
  return roles
    .filter((r) => r !== Roles.ADMIN && r !== Roles.SUPER_ADMIN)
    .map((r) => ROLE_LABELS[r] ?? r)
    .join(" · ");
}

export function AdminUsersManagement() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const currentIsSuperAdmin = session?.user?.roles?.includes(Roles.SUPER_ADMIN);

  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [candidates, setCandidates] = useState<AdminGrantCandidate[]>([]);
  const [search, setSearch] = useState("");
  const [grantEmail, setGrantEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/v1/admin/admins${q}`);
    const json = await res.json();
    setLoading(false);
    if (!json.success) {
      setError(json?.error?.message ?? "Failed to load admins");
      return;
    }
    setAdmins(json.data?.admins ?? []);
  }, [search]);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(
        `/api/v1/admin/admins/candidates?search=${encodeURIComponent(q)}`,
      );
      const json = await res.json();
      setSearching(false);
      if (json.success) {
        setCandidates(json.data?.candidates ?? []);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const stats = useMemo(
    () => ({
      total: admins.length,
      superAdmins: admins.filter((a) => a.isSuperAdmin).length,
      withDoctorRole: admins.filter((a) => a.roles.includes(Roles.DOCTOR)).length,
    }),
    [admins],
  );

  async function grantAccess(input: { email?: string; userId?: string }) {
    setGranting(true);
    setError(undefined);
    setSuccess(undefined);

    const res = await fetch("/api/v1/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    setGranting(false);

    if (!json.success) {
      setError(json?.error?.message ?? "Failed to grant admin access");
      return;
    }

    setSuccess(
      `${json.data?.admin?.name ?? "User"} now has admin access. They must sign out and back in to use the admin workspace.`,
    );
    setGrantEmail("");
    setSearch("");
    setCandidates([]);
    await loadAdmins();
  }

  async function revokeAccess(userId: string, name: string) {
    if (
      !window.confirm(
        `Remove admin access for ${name}? They will keep their other roles (e.g. doctor).`,
      )
    ) {
      return;
    }

    setRevokingId(userId);
    setError(undefined);
    setSuccess(undefined);

    const res = await fetch(`/api/v1/admin/admins/${userId}`, { method: "DELETE" });
    const json = await res.json();
    setRevokingId(null);

    if (!json.success) {
      setError(json?.error?.message ?? "Failed to revoke admin access");
      return;
    }

    setSuccess(`Admin access removed for ${name}.`);
    await loadAdmins();
  }

  function canRevoke(admin: AdminUserRow): boolean {
    if (admin.id === currentUserId) return false;
    if (admin.isSuperAdmin && !currentIsSuperAdmin) return false;
    return true;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total admins", value: stats.total },
          { label: "Super admins", value: stats.superAdmins },
          { label: "Doctor + admin", value: stats.withDoctorRole },
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

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <UserPlus className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Grant admin access</h2>
            <p className="mt-1 text-sm text-slate-600">
              Promote an existing user by email, or search by name, email, or phone.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            placeholder="user@example.com"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            className="sm:max-w-sm"
          />
          <Button
            type="button"
            disabled={granting || !grantEmail.trim()}
            onClick={() => grantAccess({ email: grantEmail.trim().toLowerCase() })}
          >
            {granting ? "Granting…" : "Grant by email"}
          </Button>
        </div>

        <div className="relative mt-4 sm:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search users to promote…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 sm:pl-10"
          />
        </div>

        {searching && (
          <p className="mt-3 text-sm text-slate-500">Searching users…</p>
        )}

        {candidates.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {candidates.map((candidate) => (
              <li
                key={candidate.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{candidate.name}</p>
                  <p className="text-sm text-slate-500">
                    {[candidate.email, candidate.phone].filter(Boolean).join(" · ")}
                  </p>
                  {candidate.roles.length > 0 && (
                    <p className="mt-1 text-xs text-slate-400">
                      {formatOtherRoles(candidate.roles)}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={granting}
                  onClick={() => grantAccess({ userId: candidate.id })}
                >
                  Make admin
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-semibold text-slate-900">Current admins</h2>
          </div>
        </div>

        {loading ? (
          <LoadingScreen message="Loading admins…" size="md" />
        ) : admins.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No admins found.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {admins.map((admin) => {
              const otherRoles = formatOtherRoles(admin.roles);
              const revokeAllowed = canRevoke(admin);

              return (
                <li
                  key={admin.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{admin.name}</p>
                      {admin.isSuperAdmin ? (
                        <Badge>Super admin</Badge>
                      ) : (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                      {admin.id === currentUserId && (
                        <Badge variant="outline">You</Badge>
                      )}
                      {!admin.isActive && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {[admin.email, admin.phone].filter(Boolean).join(" · ")}
                    </p>
                    {otherRoles && (
                      <p className="mt-1 text-xs text-slate-400">Also: {otherRoles}</p>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      "shrink-0 border-red-200 text-red-700 hover:bg-red-50",
                      !revokeAllowed && "hidden",
                    )}
                    disabled={!revokeAllowed || revokingId === admin.id}
                    onClick={() => revokeAccess(admin.id, admin.name)}
                  >
                    <ShieldOff className="mr-1.5 h-4 w-4" />
                    {revokingId === admin.id ? "Removing…" : "Remove admin"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
