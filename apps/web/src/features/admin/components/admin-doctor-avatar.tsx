import Image from "next/image";
import { cn } from "@zindagi/shared";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";

type AdminDoctorAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-9 w-9 text-xs rounded-lg",
  md: "h-12 w-12 text-sm rounded-xl",
  lg: "h-16 w-16 text-base rounded-xl",
  xl: "h-20 w-20 text-lg rounded-2xl",
};

const imageSizes = {
  sm: "36px",
  md: "48px",
  lg: "64px",
  xl: "80px",
};

export function AdminDoctorAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: AdminDoctorAvatarProps) {
  const src = resolveDoctorPortrait(name, avatarUrl);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <span
        className={cn(
          "relative shrink-0 overflow-hidden bg-slate-100 ring-2 ring-white shadow-sm",
          sizeClasses[size],
          className,
        )}
      >
        <Image
          src={src}
          alt={name}
          fill
          className="object-cover object-top"
          sizes={imageSizes[size]}
          unoptimized
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br from-brand/15 to-brand/30 font-semibold text-brand-dark ring-2 ring-white shadow-sm",
        sizeClasses[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
