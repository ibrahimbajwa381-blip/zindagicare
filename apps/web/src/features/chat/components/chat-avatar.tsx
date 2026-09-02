"use client";

import Image from "next/image";
import { cn } from "@zindagi/shared";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";

type ChatAvatarProps = {
  name: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  isDoctor?: boolean;
};

const sizeMap = {
  sm: { box: "h-10 w-10 rounded-full", text: "text-xs", image: "40px" },
  md: { box: "h-12 w-12 rounded-full", text: "text-sm", image: "48px" },
  lg: { box: "h-14 w-14 rounded-full", text: "text-base", image: "56px" },
} as const;

export function ChatAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
  isDoctor = false,
}: ChatAvatarProps) {
  const src = isDoctor
    ? resolveDoctorPortrait(name, avatarUrl)
    : avatarUrl;
  const styles = sizeMap[size];

  if (src) {
    return (
      <span
        className={cn(
          "relative shrink-0 overflow-hidden bg-slate-100 ring-2 ring-white",
          styles.box,
          className,
        )}
      >
        <Image
          src={src}
          alt={name}
          fill
          className="object-cover object-top"
          sizes={styles.image}
          unoptimized
        />
      </span>
    );
  }

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-brand-muted font-semibold text-brand-dark ring-2 ring-white",
        styles.box,
        styles.text,
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
