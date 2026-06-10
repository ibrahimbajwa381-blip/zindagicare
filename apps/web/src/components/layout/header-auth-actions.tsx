"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Roles } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/lib/auth/routes";

function dashboardHref(roles?: string[]) {
  if (roles?.includes(Roles.DOCTOR)) return AUTH_ROUTES.doctorProfile;
  if (roles?.includes(Roles.ADMIN) || roles?.includes(Roles.SUPER_ADMIN)) {
    return AUTH_ROUTES.adminDoctors;
  }
  return siteConfig.links.dashboard;
}

type HeaderAuthActionsProps = {
  loginLabel: string;
  getStartedLabel: string;
  createAccountLabel: string;
  layout: "desktop" | "mobile";
};

export function HeaderAuthActions({
  loginLabel,
  getStartedLabel,
  createAccountLabel,
  layout,
}: HeaderAuthActionsProps) {
  const { data: session } = useSession();

  if (session?.user) {
    const name = session.user.name?.trim() || "Account";
    const href = dashboardHref(session.user.roles);

    if (layout === "mobile") {
      return (
        <Button variant="outline" size="lg" className="h-12 w-full rounded-xl" asChild>
          <Link href={href}>{name}</Link>
        </Button>
      );
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        className="max-w-[12rem] truncate rounded-lg font-medium"
        asChild
      >
        <Link href={href} title={name}>
          {name}
        </Link>
      </Button>
    );
  }

  if (layout === "mobile") {
    return (
      <>
        <Button variant="outline" size="lg" className="h-12 w-full rounded-xl" asChild>
          <Link href={siteConfig.links.login}>{loginLabel}</Link>
        </Button>
        <Button
          size="lg"
          className="h-12 w-full rounded-xl bg-brand shadow-sm hover:bg-brand-dark"
          asChild
        >
          <Link href={siteConfig.links.register}>{createAccountLabel}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="rounded-lg" asChild>
        <Link href={siteConfig.links.login}>{loginLabel}</Link>
      </Button>
      <Button
        size="sm"
        className="rounded-lg bg-brand shadow-sm shadow-brand/25 hover:bg-brand-dark"
        asChild
      >
        <Link href={siteConfig.links.register}>{getStartedLabel}</Link>
      </Button>
    </>
  );
}

export function HeaderUserName({ className }: { className?: string }) {
  const { data: session } = useSession();
  if (!session?.user) return null;

  const name = session.user.name?.trim() || "Account";
  const href = dashboardHref(session.user.roles);

  return (
    <Link
      href={href}
      title={name}
      className={
        className ??
        "hidden max-w-[10rem] truncate rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-muted hover:text-brand-dark md:inline-block"
      }
    >
      {name}
    </Link>
  );
}
