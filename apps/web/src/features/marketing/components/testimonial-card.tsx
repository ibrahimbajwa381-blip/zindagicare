"use client";

import Image from "next/image";
import { useState } from "react";
import { Quote, Star, User } from "lucide-react";
import { cn } from "@zindagi/shared";
import { surfaceCard } from "@/lib/ui/surfaces";

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            "h-4 w-4",
            index < rating ? "fill-amber-400 text-amber-400" : "text-slate-200",
          )}
        />
      ))}
    </span>
  );
}

export type TestimonialCardData = {
  id: string;
  patientName: string;
  patientTitle?: string;
  avatarUrl?: string;
  rating?: number;
  content: string;
};

const COLLAPSED_LINE_CLAMP = 5;

export function TestimonialCard({ item }: { item: TestimonialCardData }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.content.length > 220;

  return (
    <article className={cn(surfaceCard, "relative flex flex-col gap-3 p-6")}>
      <Quote className="h-6 w-6 text-brand-light" aria-hidden />
      {item.rating ? <RatingStars rating={item.rating} /> : null}
      <p
        className={cn(
          "flex-1 text-sm leading-relaxed text-slate-700",
          !expanded && isLong && "line-clamp-5",
        )}
      >
        {item.content}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-start text-xs font-semibold text-brand-dark hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
      <div className="mt-1 flex items-center gap-3">
        {item.avatarUrl ? (
          <Image
            src={item.avatarUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            unoptimized={!item.avatarUrl.startsWith("/")}
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-muted/40 text-brand-dark">
            <User className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.patientName}</p>
          {item.patientTitle ? (
            <p className="truncate text-xs text-slate-500">{item.patientTitle}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
