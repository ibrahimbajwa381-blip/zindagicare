import Image from "next/image";
import { BadgeCheck, Star } from "lucide-react";
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
}: DoctorCardProps) {
  return (
    <Card
      className={`group overflow-hidden duration-300 hover:-translate-y-1 ${surfaceCardInteractive}`}
    >
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
        <p className="text-sm text-slate-600">{hospital}</p>
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
      </CardContent>
    </Card>
  );
}
