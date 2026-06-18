"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import {
  HERO_CAROUSEL_HEIGHT,
  HERO_USAMA_CAROUSEL_IMAGE_CLASS,
  type HeroService,
} from "@/features/marketing/data/hero-services";

const AUTO_ADVANCE_MS = 3000;

type HeroCarouselLabels = {
  prevService: string;
  nextService: string;
};

type HeroCarouselProps = {
  services: HeroService[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  labels: HeroCarouselLabels;
};

const SWIPE_THRESHOLD_PX = 48;

export function HeroCarousel({
  services,
  activeIndex,
  onIndexChange,
  labels,
}: HeroCarouselProps) {
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (index: number) => {
      const next =
        ((index % services.length) + services.length) % services.length;
      onIndexChange(next);
    },
    [onIndexChange, services.length],
  );

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(goNext, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [goNext, isPaused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    setIsPaused(false);
    if (start == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const delta = endX - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) goNext();
    else goPrev();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl sm:rounded-3xl",
        HERO_CAROUSEL_HEIGHT,
      )}
      aria-roledescription="carousel"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {services.map((service, index) => {
        const isActive = index === activeIndex;

        return (
          <div
            key={service.id}
            aria-hidden={!isActive}
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              isActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0",
            )}
          >
            <div aria-hidden className="absolute inset-0 bg-hero-brand" />
            <div
              aria-hidden
              className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-brand-lighter/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-accent-lighter/25 blur-3xl"
            />

            <div className="relative flex h-full flex-col overflow-hidden lg:flex-row">
              <div className="flex shrink-0 flex-col p-5 pr-12 sm:p-7 sm:pr-8 lg:w-[38%] lg:max-w-xl lg:shrink-0 lg:justify-center lg:p-10 xl:w-[36%]">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/95 sm:text-sm">
                  {service.carousel.eyebrow}
                </p>
                <h2 className="mt-2 font-display text-[1.625rem] font-bold leading-[1.15] tracking-tight text-white drop-shadow-sm sm:mt-2.5 sm:text-4xl lg:text-[2.75rem]">
                  {service.carousel.title}{" "}
                  <span className="text-gradient-hero">
                    {service.carousel.titleHighlight}
                  </span>
                </h2>
                <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3.5 py-2 text-sm font-medium leading-snug text-white backdrop-blur-sm sm:mt-4 sm:px-4 sm:py-2.5 sm:text-base">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-brand-lighter sm:h-5 sm:w-5" />
                  <span>{service.carousel.badge}</span>
                </div>
                <div className="mt-4 sm:mt-5">
                  <Button
                    size="lg"
                    className="shadow-premium h-14 w-full rounded-xl px-6 text-base font-semibold shadow-brand-dark/25 sm:h-12 sm:w-auto sm:text-lg"
                    asChild
                  >
                    <Link href={service.carousel.href}>
                      {service.carousel.ctaLabel}
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="flex min-h-[11.5rem] flex-1 flex-col sm:min-h-[14rem] lg:min-h-0 lg:flex-row">
                <div className="relative min-h-[11.5rem] flex-1 sm:min-h-[14rem] lg:min-h-0 lg:min-w-0">
                  <Image
                    src={service.image}
                    alt={service.imageAlt}
                    fill
                    priority={index === 0}
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes="(max-width: 1024px) 100vw, 38vw"
                    className={cn(
                      "object-cover",
                      service.id === "online-consult"
                        ? HERO_USAMA_CAROUSEL_IMAGE_CLASS
                        : service.id === "sunday-consult"
                          ? "object-center lg:object-[center_35%]"
                          : "object-center lg:object-[center_20%]",
                    )}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-brand-dark/90 via-brand-dark/20 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-brand-dark/35"
                  />
                </div>

                <div className="hidden lg:flex lg:w-[min(22rem,34%)] lg:shrink-0 lg:flex-col lg:justify-center lg:border-l lg:border-white/10 lg:bg-white/5 lg:px-8 lg:py-10 lg:backdrop-blur-sm xl:px-10">
                  <p className="text-lg leading-relaxed text-white/90 xl:text-xl">
                    {service.carousel.description}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {service.carousel.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-sm font-medium text-white/85 xl:text-base"
                      >
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-lighter" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="absolute right-3 top-3 z-20 hidden gap-1 sm:right-6 sm:top-6 sm:flex">
        <CarouselNavButton direction="prev" onClick={goPrev} label={labels.prevService} />
        <CarouselNavButton direction="next" onClick={goNext} label={labels.nextService} />
      </div>

      <div
        className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0 lg:bottom-8 lg:right-10"
        role="tablist"
        aria-label="Hero services"
      >
        {services.map((service, index) => (
          <button
            key={service.id}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={service.carousel.eyebrow}
            onClick={() => goTo(index)}
            className={cn(
              "pointer-events-auto h-2 rounded-full transition-all duration-300",
              index === activeIndex
                ? "w-8 bg-brand-lighter"
                : "w-2 bg-white/35 hover:bg-white/55",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function CarouselNavButton({
  direction,
  onClick,
  label,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  label: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-95 sm:h-9 sm:w-9"
      aria-label={label}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
