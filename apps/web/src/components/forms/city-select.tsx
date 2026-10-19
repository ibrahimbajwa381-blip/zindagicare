"use client";

import { PAKISTAN_CITIES } from "@zindagi/shared";
import { SearchableSelect, type SearchableOption } from "@/components/forms/searchable-select";

const CITY_OPTIONS: readonly SearchableOption[] = PAKISTAN_CITIES.map((city) => ({ value: city }));

type Props = {
  id: string;
  value: string;
  onChange: (city: string) => void;
  className?: string;
};

/** Searchable Pakistani city picker; a town not in the list can be typed. */
export function CitySelect({ id, value, onChange, className }: Props) {
  return (
    <SearchableSelect
      id={id}
      value={value}
      onChange={onChange}
      options={CITY_OPTIONS}
      label="Cities"
      placeholder="Select city"
      searchPlaceholder="Search city…"
      allowCustom
      className={className}
    />
  );
}
