"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import { featuredSpecialties } from "../data/browse-catalog";
import { BrowseIconTile } from "./browse-icon-tile";
import { SpecialtyBrowseModal } from "./specialty-browse-modal";

export function SpecialtiesBrowseSection() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div>
        <div className="flex items-end justify-between gap-3">
          <h3 className="min-w-0 font-display text-lg font-semibold tracking-tight text-foreground sm:text-2xl">
            Consult best doctors online
          </h3>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-brand underline-offset-4 transition-colors hover:text-brand-dark hover:underline active:bg-brand-muted/50"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-x-1 gap-y-5 sm:mt-8 sm:grid-cols-4 sm:gap-x-2 sm:gap-y-6 md:grid-cols-8 md:gap-x-3">
          {featuredSpecialties.map((item) => (
            <BrowseIconTile
              key={item.slug}
              item={item}
              href={`${siteConfig.links.doctors}?specialty=${item.slug}`}
            />
          ))}
        </div>
      </div>

      <SpecialtyBrowseModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
