export type NutritionistWeeklyAvailabilityDto = {
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
};

export type NutritionistClinicInput = {
  name: string;
  city: string;
  address?: string;
};

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatDayOfWeek(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

export function formatPkr(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}
