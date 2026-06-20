"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@zindagi/shared";

type FaqItem = {
  q: string;
  a: string;
};

type FaqAccordionProps = {
  items: FaqItem[];
};

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-light/30 bg-white shadow-premium sm:rounded-3xl">
      {items.map((faq, index) => {
        const isOpen = openIndex === index;
        const number = String(index + 1).padStart(2, "0");

        return (
          <div
            key={faq.q}
            className={cn(
              "border-b border-slate-100 last:border-b-0",
              isOpen && "bg-brand-muted/35",
            )}
          >
            <button
              type="button"
              id={`faq-trigger-${index}`}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${index}`}
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="flex w-full items-start gap-3 px-4 py-4 text-start transition-colors hover:bg-slate-50/80 sm:gap-4 sm:px-6 sm:py-5"
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors sm:h-9 sm:w-9 sm:text-sm",
                  isOpen
                    ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm"
                    : "bg-brand-muted text-brand-dark",
                )}
              >
                {number}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 font-display text-[0.9375rem] font-semibold leading-snug text-foreground sm:text-lg">
                {faq.q}
              </span>
              <ChevronDown
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0 text-brand transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            <div
              id={`faq-panel-${index}`}
              role="region"
              aria-labelledby={`faq-trigger-${index}`}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-4 ps-[3.25rem] text-sm leading-relaxed text-slate-600 sm:px-6 sm:pb-5 sm:ps-[4.25rem] sm:text-[0.9375rem]">
                  {faq.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
