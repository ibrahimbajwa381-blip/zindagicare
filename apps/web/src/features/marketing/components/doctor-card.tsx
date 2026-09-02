import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Star } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

type DoctorCardProps = {
  name: string;
  specialty: string;
  hospital: string;
  rating: number;
  reviews: number;
  fee: number;
  pmdcVerified: boolean;
  imageUrl?: string;
  pmdcLabel?: string;
  /** Degrees / fellowships e.g. MBBS, MRCP, MD Cardiology (R) */
  credentials?: string[];
  href?: string;
  availableSlots?: number;
  isFull?: boolean;
  slotsOpenLabel?: string;
  noSlotsLabel?: string;
  bookLabel?: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DoctorCard({
  name,
  specialty,
  hospital,
  rating,
  reviews,
  fee,
  pmdcVerified,
  imageUrl,
  pmdcLabel = "PMDC",
  credentials = [],
  href,
  isFull,
  slotsOpenLabel,
  noSlotsLabel,
  bookLabel,
}: DoctorCardProps) {
  const showSlots = slotsOpenLabel !== undefined || noSlotsLabel !== undefined;
  const showRating = reviews > 0 && rating > 0;
  const shownCredentials = credentials.filter(Boolean);

  const card = (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden duration-300 hover:-translate-y-1",
        surfaceCardInteractive,
        href && "cursor-pointer",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-dark to-brand-light"
      />

      <div className="flex flex-1 flex-col gap-3 p-4 pt-5 sm:gap-3.5 sm:p-5 sm:pt-6">
        <div className="flex items-start gap-3">
          {imageUrl ? (
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200/80 transition-colors group-hover:ring-brand-light/50">
              <Image
                src={imageUrl}
                alt={name}
                fill
                className="object-cover object-top"
                sizes="56px"
                unoptimized
              />
            </span>
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-sm font-semibold text-brand-dark ring-1 ring-slate-200/80 transition-colors group-hover:from-brand-muted group-hover:to-brand-muted/80 group-hover:ring-brand-light/50">
              {initials(name)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[0.95rem] font-semibold leading-snug tracking-tight text-foreground sm:text-base">
              <span className="line-clamp-2 [overflow-wrap:normal] [word-break:normal] hyphens-none">
                {name}
              </span>
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate text-sm text-brand/90">{specialty}</p>
              {pmdcVerified ? (
                <Badge
                  variant="secondary"
                  className="h-5 shrink-0 gap-0.5 border-brand-light/50 bg-brand-muted px-1.5 text-[10px] font-semibold text-brand-muted-foreground"
                >
                  <BadgeCheck className="h-3 w-3" />
                  {pmdcLabel}
                </Badge>
              ) : null}
            </div>
            {shownCredentials.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {shownCredentials.map((credential) => (
                  <Badge
                    key={credential}
                    variant="outline"
                    className="h-5 border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-700"
                  >
                    {credential}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {hospital ? (
          <p className="truncate text-sm leading-snug text-slate-600">{hospital}</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          {showRating ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {rating}
              <span className="font-normal text-slate-500">({reviews})</span>
            </span>
          ) : (
            <span aria-hidden className="min-w-0" />
          )}
          <span className="shrink-0 font-display text-sm font-semibold text-brand-dark">
            Rs. {fee.toLocaleString()}
          </span>
        </div>

        {showSlots ? (
          <div className="flex items-center justify-between gap-3">
            <Badge
              variant="outline"
              className={cn(
                "border-brand/20 text-xs font-medium",
                isFull
                  ? "bg-slate-50 text-slate-500"
                  : "border-brand/30 bg-brand-muted/40 text-brand-dark",
              )}
            >
              {isFull ? noSlotsLabel : slotsOpenLabel}
            </Badge>
            {bookLabel && href ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark transition group-hover:gap-1.5">
                {bookLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {card}
      </Link>
    );
  }

  return card;
}
