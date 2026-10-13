"use client";

import { useMemo } from "react";
import { areaZonesForCity } from "@zindagi/shared";
import { formatCityName } from "@/lib/geo/city-match";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/forms/searchable-select";

type Props = {
  id: string;
  city: string;
  value: string;
  onChange: (area: string) => void;
  /** When set, a city without a list still asks for an area (no "optional" hint). */
  required?: boolean;
};

/**
 * Area within the chosen city: a searchable list for cities we have areas for
 * (unlisted areas can still be typed), otherwise a plain optional text box.
 */
export function CityAreaSelect({ id, city, value, onChange, required }: Props) {
  const zones = areaZonesForCity(city);
  const options = useMemo<readonly SearchableOption[]>(
    () => (zones ?? []).flatMap(({ zone, areas }) => areas.map((area) => ({ value: area, group: zone }))),
    [zones],
  );
  const cityLabel = formatCityName(city) || "your city";

  if (!zones) {
    return (
      <div>
        <Label htmlFor={id}>Area / neighbourhood{required ? "" : " (optional)"}</Label>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Area in ${cityLabel}`}
          className="mt-1"
        />
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={id}>Area in {cityLabel}</Label>
      <SearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        label={`${cityLabel} areas`}
        placeholder="Select area"
        searchPlaceholder="Search area…"
        allowCustom
        className="mt-1"
      />
    </div>
  );
}
