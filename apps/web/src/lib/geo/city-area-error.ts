/**
 * City and area are both mandatory for providers. Returns a simple message
 * naming whichever is missing (or both), or undefined when both are filled.
 * `where` names the location in multi-location forms, e.g. "for Location 2".
 */
export function cityAreaError(city: string, area: string, where?: string): string | undefined {
  const noCity = city.trim().length < 2;
  const noArea = area.trim().length < 2;
  const suffix = where ? ` ${where}` : "";
  if (noCity && noArea) return `Please fill in both city and area${suffix}.`;
  if (noCity) return `Please select the city${suffix}.`;
  if (noArea) return `Please select the area${suffix}.`;
  return undefined;
}
