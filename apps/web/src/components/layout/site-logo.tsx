"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";

/** Intrinsic dimensions of public/logo.png (wordmark). */
const LOGO_WIDTH = 320;
const LOGO_HEIGHT = 120;

const sizes = {
  sm: "h-10 w-auto max-w-[8rem] object-contain object-left",
  md: "h-11 w-auto max-w-[8.5rem] object-contain object-left sm:h-12 sm:max-w-[9rem]",
  lg: "h-11 w-auto max-w-[9rem] object-contain object-left sm:h-14 sm:max-w-[10rem] md:h-16 md:max-w-[11rem]",
  xl: "h-16 w-auto max-w-[11rem] object-contain object-left sm:h-20 sm:max-w-[13rem] md:h-24 md:max-w-[15rem]",
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
      <span className="inline-flex shrink-0 items-center py-0.5">
        <Image
          src={siteConfig.logo}
          alt={siteConfig.name}
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          className={cn(sizes[size])}
          priority={priority ?? size !== "sm"}
          unoptimized
        />
      </span>
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
