import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Star } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  href,
  availableSlots,
  isFull,
  slotsOpenLabel,
  noSlotsLabel,
  bookLabel,
}: DoctorCardProps) {
  const showSlots = slotsOpenLabel !== undefined || noSlotsLabel !== undefined;
  const card = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden duration-300 hover:-translate-y-1",
        surfaceCardInteractive,
        href && "cursor-pointer",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-dark to-brand-light"
      />
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {imageUrl ? (
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200/80 transition-colors group-hover:ring-brand-light/50">
              <Image
                src={imageUrl}
                alt={name}
                fill
                className="object-cover object-top"
                sizes="56px"
              />
            </span>
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-sm font-semibold text-brand-dark ring-1 ring-slate-200/80 transition-colors group-hover:from-brand-muted group-hover:to-brand-muted/80 group-hover:ring-brand-light/50">
              {initials(name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="font-display text-base font-semibold leading-snug">
                {name}
              </CardTitle>
              {pmdcVerified && (
                <Badge
                  variant="secondary"
                  className="shrink-0 gap-1 border-brand-light/50 bg-brand-muted text-xs text-brand-muted-foreground"
                >
                  <BadgeCheck className="h-3 w-3" />
                  {pmdcLabel}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-brand/90">{specialty}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hospital ? <p className="text-sm text-slate-600">{hospital}</p> : null}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {rating}
            <span className="font-normal text-slate-500">({reviews})</span>
          </span>
          <span className="font-display text-sm font-semibold text-brand-dark">
            Rs. {fee.toLocaleString()}
          </span>
        </div>
        {showSlots && (
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
            {bookLabel && href && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark transition group-hover:gap-1.5">
                {bookLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {card}
      </Link>
    );
  }

  return card;
}
