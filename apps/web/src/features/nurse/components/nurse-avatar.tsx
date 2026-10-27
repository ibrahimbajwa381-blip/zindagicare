import Image from "next/image";
import { cn } from "@zindagi/shared";

type NurseAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-9 w-9 text-xs rounded-lg",
  md: "h-12 w-12 text-sm rounded-xl",
  lg: "h-16 w-16 text-base rounded-xl",
  xl: "h-24 w-24 text-xl rounded-2xl",
};

const imageSizes = {
  sm: "36px",
  md: "48px",
  lg: "64px",
  xl: "96px",
};

export function NurseAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: NurseAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (avatarUrl) {
    return (
      <span
        className={cn(
          "relative shrink-0 overflow-hidden bg-slate-100 ring-2 ring-white shadow-sm",
          sizeClasses[size],
          className,
        )}
      >
        <Image
          src={avatarUrl}
          alt={name}
          fill
          className="object-cover object-top"
          sizes={imageSizes[size]}
          unoptimized={!String(avatarUrl).startsWith("/")}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br from-brand/20 to-brand/40 font-semibold text-brand-dark ring-2 ring-white shadow-sm",
        sizeClasses[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
