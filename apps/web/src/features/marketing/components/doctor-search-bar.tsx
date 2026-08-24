"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type DoctorSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function DoctorSearchBar({ value, onChange, placeholder }: DoctorSearchBarProps) {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <Input
        type="search"
        inputMode="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Search by doctor name, specialty, or disease (e.g. diabetes, heart)"}
        className="h-12 rounded-full pl-11 pr-10 text-sm sm:h-12 sm:rounded-full sm:pl-11 sm:pr-10 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        aria-label="Search doctors by name, specialty, or disease"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
