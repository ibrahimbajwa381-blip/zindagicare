"use client";

import { Home, MapPin, Video, X } from "lucide-react";
import { cn } from "@zindagi/shared";
import { CitySelect } from "@/components/forms/city-select";
import { useTranslations } from "@/i18n/locale-provider";

type DoctorFilterBarProps = {
  homeVisit: boolean;
  onHomeVisitChange: (homeVisit: boolean) => void;
  city: string;
  /** Omitted on city-scoped pages, where the city is shown but fixed. */
  onCityChange?: (city: string) => void;
};

export function DoctorFilterBar({ homeVisit, onHomeVisitChange, city, onCityChange }: DoctorFilterBarProps) {
  const copy = useTranslations().doctors.page.filters;
  const visitOptions = [
    { value: false, label: copy.online, Icon: Video },
    { value: true, label: copy.homeVisit, Icon: Home },
  ];

  return (
    <div
      role="group"
      aria-label={copy.label}
      className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center"
    >
      <div
        role="radiogroup"
        aria-label={copy.visitType}
        className="grid shrink-0 grid-cols-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm"
      >
        {visitOptions.map(({ value, label, Icon }) => {
          const selected = homeVisit === value;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onHomeVisitChange(value)}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                selected ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {onCityChange ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <CitySelect
            id="doctor-filter-city"
            value={city}
            onChange={onCityChange}
            placeholder={copy.allCities}
            className="min-w-0 flex-1"
          />
          {city && (
            <button
              type="button"
              onClick={() => onCityChange("")}
              className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label={copy.clearCity}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
          <span className="sr-only">{copy.city}: </span>
          {city}
        </p>
      )}
    </div>
  );
}
