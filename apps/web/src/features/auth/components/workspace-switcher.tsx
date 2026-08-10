"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTransition } from "react";
import {
  getAvailableWorkspaces,
  workspaceHomePath,
  cn,
  type Workspace,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";

const WORKSPACE_LABELS: Record<Workspace, string> = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Admin",
  nurse: "Nurse",
  physiotherapist: "Physiotherapist",
  rider: "Rider",
};

const WORKSPACE_DESCRIPTIONS: Record<Workspace, string> = {
  patient: "Book consultations and manage your health records.",
  doctor: "Manage patients, prescriptions, and your practice.",
  admin: "Review applications, dispatch visits, and run operations.",
  nurse: "Home nursing visits and availability.",
  physiotherapist: "Home physiotherapy visits and availability.",
  rider: "Deliveries and logistics.",
};

type Props = {
  className?: string;
  /** Highlight the workspace the user is currently in. */
  current?: Workspace;
};

export function WorkspaceSwitcher({ className, current }: Props) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const roles = session?.user?.roles ?? [];
  const activeWorkspace = session?.user?.activeWorkspace;
  const workspaces = getAvailableWorkspaces(roles);

  if (workspaces.length < 2) return null;

  const highlighted = current ?? activeWorkspace;

  async function switchTo(workspace: Workspace) {
    if (workspace === activeWorkspace) return;

    startTransition(async () => {
      await update({ activeWorkspace: workspace });
      router.push(workspaceHomePath(workspace));
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">
        Switch profile
      </p>
      <p className="mt-1 text-sm text-slate-600">
        You have access to multiple workspaces. Choose which profile to use.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {workspaces.map((workspace) => {
          const isActive = workspace === highlighted;
          return (
            <Button
              key={workspace}
              type="button"
              variant={isActive ? "default" : "outline"}
              disabled={pending}
              className={cn(
                "h-auto min-h-10 w-full min-w-0 flex-col items-start gap-0.5 whitespace-normal px-4 py-2.5 text-left sm:h-auto",
                isActive && "ring-2 ring-brand/30",
              )}
              onClick={() => switchTo(workspace)}
            >
              <span className="font-semibold">{WORKSPACE_LABELS[workspace]}</span>
              <span className="w-full text-xs font-normal leading-snug whitespace-normal opacity-80">
                {WORKSPACE_DESCRIPTIONS[workspace]}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
