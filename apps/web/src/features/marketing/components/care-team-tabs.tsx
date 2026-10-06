"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { DoctorCard } from "./doctor-card";

export type CareTeamCard = {
  key: string;
  href: string;
  name: string;
  specialty: string;
  location: string;
  rating: number;
  reviews: number;
  fee: number;
  imageUrl?: string;
  credentials: string[];
};

export type CareTeamGroup = {
  id: string;
  label: string;
  viewAllHref: string;
  viewAllLabel: string;
  cards: CareTeamCard[];
};

/** Landing-page provider showcase — one tab per provider role that has listed profiles. */
export function CareTeamTabs({
  groups,
  verifiedLabel,
}: {
  groups: CareTeamGroup[];
  verifiedLabel: string;
}) {
  const [activeId, setActiveId] = useState(groups[0]?.id);
  const active = groups.find((g) => g.id === activeId) ?? groups[0];
  if (!active) return null;

  return (
    <div className="mt-6 sm:mt-10">
      <div
        role="tablist"
        aria-label="Provider type"
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
      >
        {groups.map((group) => {
          const selected = group.id === active.id;
          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              id={`care-team-tab-${group.id}`}
              aria-selected={selected}
              aria-controls={`care-team-panel-${group.id}`}
              onClick={() => setActiveId(group.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                selected
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white/80 text-slate-700 hover:border-brand/40 hover:text-brand-dark",
              )}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`care-team-panel-${active.id}`}
        aria-labelledby={`care-team-tab-${active.id}`}
        className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
      >
        {active.cards.map((card) => (
          <DoctorCard
            key={card.key}
            href={card.href}
            name={card.name}
            specialty={card.specialty}
            hospital={card.location}
            rating={card.rating}
            reviews={card.reviews}
            fee={card.fee}
            pmdcVerified
            pmdcLabel={verifiedLabel}
            imageUrl={card.imageUrl}
            credentials={card.credentials}
            withDoctorTitle={false}
          />
        ))}
      </div>

      <div className="mt-6 flex justify-end sm:mt-8">
        <Button className="flex h-10 w-full items-center gap-1.5 rounded-xl px-4 sm:w-auto" asChild>
          <Link href={active.viewAllHref}>
            {active.viewAllLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
