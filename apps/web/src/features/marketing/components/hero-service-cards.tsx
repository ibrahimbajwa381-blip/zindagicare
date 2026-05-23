"use client";

import type { MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@zindagi/shared";
import { heroServices } from "@/features/marketing/data/hero-services";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

type HeroServiceCardsProps = {
  activeIndex: number;
  onSelect: (index: number) => void;
};

export function HeroServiceCards({
  activeIndex,
  onSelect,
}: HeroServiceCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {heroServices.map((service, index) => {
        const isActive = index === activeIndex;

        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "group flex flex-col overflow-hidden rounded-xl text-left duration-200 sm:rounded-2xl",
              surfaceCardInteractive,
              isActive
                ? "border-brand-light/80 shadow-premium ring-2 ring-brand-light/25"
                : "",
            )}
          >
            <div className="relative h-24 w-full shrink-0 overflow-hidden sm:h-28">
              <Image
                src={service.image}
                alt={service.imageAlt}
                fill
                sizes="(max-width: 1024px) 50vw, 20vw"
                className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
              />
              {service.id === "online-consult" && (
                <span className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:text-xs">
                  Doctors online
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4">
              <h3 className="font-display text-sm font-semibold text-foreground sm:text-base">
                {service.card.title}
              </h3>
              <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                {service.card.description}
              </p>
              <Link
                href={service.carousel.href}
                onClick={(e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
                className="mt-2 text-xs font-medium text-brand hover:text-brand-dark sm:text-sm"
              >
                Learn more →
              </Link>
            </div>
          </button>
        );
      })}
    </div>
  );
}
