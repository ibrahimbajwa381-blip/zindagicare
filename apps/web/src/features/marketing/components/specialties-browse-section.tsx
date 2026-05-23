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
        <div className="flex items-end justify-between gap-4">
          <h3 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Consult best doctors online
          </h3>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand underline-offset-4 transition-colors hover:text-brand-dark hover:underline"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-8 grid grid-cols-4 gap-x-2 gap-y-6 md:grid-cols-8 md:gap-x-3">
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
