"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";

/** Intrinsic dimensions of public/logo.png (wordmark). */
const LOGO_WIDTH = 320;
const LOGO_HEIGHT = 120;

const sizes = {
  sm: "h-11 w-auto min-w-[7.5rem]",
  md: "h-12 w-auto min-w-[8rem]",
  lg: "h-14 w-auto min-w-[9rem] sm:h-16 sm:min-w-[10rem]",
  xl: "h-20 w-auto min-w-[11rem] sm:h-24 sm:min-w-[13rem]",
} as const;

type SiteLogoProps = {
  size?: keyof typeof sizes;
  showName?: boolean;
  href?: string | null;
  className?: string;
  nameClassName?: string;
  priority?: boolean;
};

export function SiteLogo({
  size = "md",
  showName = false,
  href = "/",
  className,
  nameClassName,
  priority,
}: SiteLogoProps) {
  const content = (
    <>
      <Image
        src={siteConfig.logo}
        alt={siteConfig.name}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={cn("shrink-0 object-contain", sizes[size])}
        priority={priority ?? size !== "sm"}
        unoptimized
      />
      {showName ? (
        <span
          className={cn(
            "font-display font-semibold tracking-tight",
            nameClassName,
          )}
        >
          {siteConfig.name}
        </span>
      ) : null}
    </>
  );

  const wrapperClass = cn("inline-flex items-center gap-2.5", className);

  if (href) {
    return (
      <Link href={href} className={wrapperClass}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}
