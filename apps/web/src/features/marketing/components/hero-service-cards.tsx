"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@zindagi/shared";
import {
  HERO_USAMA_CARD_IMAGE_CLASS,
  HOME_PHYSIO_HERO_IMAGE_CLASS,
  URGENT_CARE_HERO_IMAGE_CLASS,
  type HeroService,
} from "@/features/marketing/data/hero-services";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { useTranslations } from "@/i18n/locale-provider";

type HeroServiceCardsProps = {
  services: HeroService[];
  activeIndex: number;
  onSelect: (index: number) => void;
  labels: {
    learnMore: string;
    swipeHint: string;
    freeBadge: string;
  };
};

export function HeroServiceCards({
  services,
  activeIndex,
  onSelect,
  labels,
}: HeroServiceCardsProps) {
  const t = useTranslations();
  const pinRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pin = pinRef.current;
    const sticky = stickyRef.current;
    const track = trackRef.current;
    if (!pin || !sticky || !track) return;

    const mobileQuery = window.matchMedia("(max-width: 639px)");
    let frame = 0;

    const reset = () => {
      pin.style.height = "";
      track.style.transform = "";
      sticky.style.overflowX = "";
      sticky.style.touchAction = "";
    };

    // On mobile, cards scroll right-to-left via a plain native horizontal
    // swipe — no vertical-scroll-driven pin, so no reserved blank space
    // below the cards while the reveal plays out.
    const sync = () => {
      if (!mobileQuery.matches) {
        reset();
        return;
      }

      pin.style.height = "";
      track.style.transform = "";
      sticky.style.overflowX = "auto";
      sticky.style.touchAction = "pan-x pan-y pinch-zoom";
    };

    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener("resize", onResize);
    mobileQuery.addEventListener("change", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      mobileQuery.removeEventListener("change", onResize);
      reset();
    };
  }, [services.length]);

  return (
    <div>
      <div ref={pinRef} className="relative sm:!h-auto">
        <div
          ref={stickyRef}
          className="top-20 sm:static sm:top-auto sm:overflow-visible max-sm:sticky max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[-ms-overflow-style:none] max-sm:[&::-webkit-scrollbar]:hidden"
        >
          <div
            ref={trackRef}
            className="flex w-max max-w-none flex-nowrap gap-3 pb-1 will-change-transform sm:grid sm:w-full sm:grid-cols-2 sm:gap-4 sm:pb-0 sm:will-change-auto lg:grid-cols-5"
            role="list"
            aria-label={labels.swipeHint}
          >
            {services.map((service, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={service.id}
                  type="button"
                  role="listitem"
                  onClick={() => onSelect(index)}
                  className={cn(
                    "group flex w-[10.5rem] shrink-0 flex-col overflow-hidden rounded-xl text-left duration-200 sm:w-auto sm:rounded-2xl",
                    surfaceCardInteractive,
                    isActive
                      ? "border-brand-light/80 shadow-premium ring-2 ring-brand-light/25"
                      : "",
                  )}
                >
                  <div className="relative h-32 w-full shrink-0 overflow-hidden sm:h-40">
                    <Image
                      src={service.image}
                      alt={service.imageAlt}
                      fill
                      sizes="(max-width: 640px) 42vw, 20vw"
                      className={cn(
                        "object-cover transition-transform duration-300 group-hover:scale-105",
                        service.id === "online-consult"
                          ? HERO_USAMA_CARD_IMAGE_CLASS
                          : service.id === "in-house-medical"
                            ? "object-[center_20%]"
                            : service.id === "home-physiotherapy"
                              ? HOME_PHYSIO_HERO_IMAGE_CLASS
                              : service.id === "urgent-care"
                                ? URGENT_CARE_HERO_IMAGE_CLASS
                                : "object-center",
                      )}
                    />
                    {service.id === "sunday-consult" && (
                      <span className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:text-xs">
                        {labels.freeBadge}
                      </span>
                    )}
                    {service.id === "urgent-care" && (
                      <span className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:text-xs">
                        {t.nav.urgentBadge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-3 py-2.5 sm:px-4 sm:py-4">
                    <h3 className="font-display text-sm font-semibold text-foreground sm:text-base">
                      {service.card.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500 sm:mt-1 sm:text-sm">
                      {service.card.description}
                    </p>
                    <Link
                      href={service.carousel.href}
                      onClick={(e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
                      className="mt-2 inline-flex min-h-9 items-center text-xs font-medium text-brand hover:text-brand-dark sm:text-sm"
                    >
                      {labels.learnMore}
                    </Link>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500 sm:hidden">
        {labels.swipeHint}
      </p>
    </div>
  );
}
