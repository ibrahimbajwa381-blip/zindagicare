"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@zindagi/shared";

type HeaderIconButtonProps = {
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  label: string;
  count?: number;
  active?: boolean;
  className?: string;
};

function formatCount(count: number) {
  if (count > 99) return "99+";
  return String(count);
}

export function HeaderIconButton({
  href,
  onClick,
  icon: Icon,
  label,
  count = 0,
  active = false,
  className,
}: HeaderIconButtonProps) {
  const content = (
    <>
      <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={1.75} aria-hidden />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[0.625rem] font-semibold leading-none text-white ring-2 ring-white">
          {formatCount(count)}
        </span>
      ) : null}
    </>
  );

  const sharedClassName = cn(
    "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors",
    "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/50",
    active && "bg-slate-100 text-slate-900",
    className,
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={sharedClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={sharedClassName}
    >
      {content}
    </button>
  );
}
