"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/locale-provider";

export type RouteErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

/**
 * Shared route-group error boundary. Never renders `error.message` (it can
 * carry server details); only the opaque digest, which matches server logs.
 */
export function RouteError({ error, unstable_retry }: RouteErrorProps) {
  const t = useTranslations().errorPage;

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center"
    >
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
      <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{t.description}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          className="rounded-full px-6"
          onClick={() => unstable_retry()}
        >
          {t.retry}
        </Button>
        <Button asChild variant="outline" className="rounded-full px-6">
          <Link href="/">{t.goHome}</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="text-xs text-slate-400">
          {t.reference}: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
