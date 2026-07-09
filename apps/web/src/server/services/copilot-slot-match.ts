const KARACHI_TZ = "Asia/Karachi";

export type ConsultSlot = {
  slotId: string;
  startAt: string;
  endAt: string;
  status?: string;
};

export type SlotPreference = {
  preferToday?: boolean;
  preferTomorrow?: boolean;
  preferMorning?: boolean;
  preferEvening?: boolean;
  withinMinutes?: number;
  preferHighestRated?: boolean;
};

export const SLOT_PREFERENCE_TOOL_PROPERTIES = {
  preferToday: {
    type: "boolean",
    description:
      "Prefer today. Default true unless tomorrow or a specific day is requested.",
  },
  preferTomorrow: {
    type: "boolean",
    description: "Prefer tomorrow — kal, tomorrow, agla din.",
  },
  preferMorning: {
    type: "boolean",
    description: "Morning slots before 12pm PKT — subah, morning.",
  },
  preferEvening: {
    type: "boolean",
    description: "Evening slots from 5pm PKT — shaam, evening.",
  },
  withinMinutes: {
    type: "number",
    description:
      "Only slots starting within this many minutes from now — e.g. 60 for 'next hour', 'aglay ghantay'.",
  },
  withinNextHour: {
    type: "boolean",
    description: "Shortcut for withinMinutes: 60 when patient says 'within the next hour'.",
  },
  preferHighestRated: {
    type: "boolean",
    description:
      "Pick the highest-rated doctor with a matching slot — highest-rated, best, top, aacha, achha, behtareen. Default true.",
  },
} as const;

function slotParts(iso: string) {
  const date = new Date(iso);
  const dateKey = date.toLocaleDateString("en-CA", { timeZone: KARACHI_TZ });
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: KARACHI_TZ,
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  return { dateKey, hour };
}

export function isSlotToday(iso: string, now = new Date()): boolean {
  const today = now.toLocaleDateString("en-CA", { timeZone: KARACHI_TZ });
  return slotParts(iso).dateKey === today;
}

export function isSlotTomorrow(iso: string, now = new Date()): boolean {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toLocaleDateString("en-CA", { timeZone: KARACHI_TZ });
  return slotParts(iso).dateKey === tomorrowKey;
}

export function isSlotMorning(iso: string): boolean {
  const { hour } = slotParts(iso);
  return hour >= 6 && hour < 12;
}

export function isSlotEvening(iso: string): boolean {
  return slotParts(iso).hour >= 17;
}

export function slotPreferenceFromToolArgs(
  args: Record<string, unknown>,
): SlotPreference {
  const preferTomorrow = args.preferTomorrow === true;
  const withinNextHour = args.withinNextHour === true;
  const withinMinutesRaw = args.withinMinutes;

  return {
    preferToday: args.preferToday !== false && !preferTomorrow,
    preferTomorrow,
    preferMorning: args.preferMorning === true,
    preferEvening: args.preferEvening === true,
    withinMinutes:
      typeof withinMinutesRaw === "number" && withinMinutesRaw > 0
        ? withinMinutesRaw
        : withinNextHour
          ? 60
          : undefined,
    preferHighestRated: args.preferHighestRated !== false,
  };
}

export function filterSlotsByPreference(
  slots: ConsultSlot[],
  preference: SlotPreference,
  now = new Date(),
): ConsultSlot[] {
  let filtered = slots.filter((slot) => {
    const startMs = new Date(slot.startAt).getTime();
    return startMs >= now.getTime();
  });

  if (preference.withinMinutes) {
    const deadline = now.getTime() + preference.withinMinutes * 60 * 1000;
    filtered = filtered.filter((slot) => {
      const startMs = new Date(slot.startAt).getTime();
      return startMs <= deadline;
    });
  }

  if (preference.preferTomorrow) {
    filtered = filtered.filter((slot) => isSlotTomorrow(slot.startAt, now));
  } else if (preference.preferToday) {
    filtered = filtered.filter((slot) => isSlotToday(slot.startAt, now));
  }

  if (preference.preferMorning) {
    filtered = filtered.filter((slot) => isSlotMorning(slot.startAt));
  }

  if (preference.preferEvening) {
    filtered = filtered.filter((slot) => isSlotEvening(slot.startAt));
  }

  return filtered.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
}

export function pickPreferredSlot(
  slots: ConsultSlot[],
  preference: SlotPreference,
  now = new Date(),
): ConsultSlot | undefined {
  const strict = filterSlotsByPreference(slots, preference, now);
  if (strict[0]) return strict[0];

  const relaxed: SlotPreference = {
    ...preference,
    withinMinutes: undefined,
    preferMorning: undefined,
    preferEvening: undefined,
    preferToday: undefined,
    preferTomorrow: undefined,
  };
  const fallback = filterSlotsByPreference(slots, relaxed, now);
  return fallback[0];
}

export function describeSlotPreference(preference: SlotPreference): string {
  const parts: string[] = [];
  if (preference.withinMinutes) {
    parts.push(
      preference.withinMinutes === 60
        ? "within the next hour"
        : `within ${preference.withinMinutes} minutes`,
    );
  }
  if (preference.preferTomorrow && preference.preferMorning) {
    parts.push("tomorrow morning");
  } else if (preference.preferTomorrow && preference.preferEvening) {
    parts.push("tomorrow evening");
  } else if (preference.preferTomorrow) {
    parts.push("tomorrow");
  } else if (preference.preferToday) {
    parts.push("today");
  }
  if (preference.preferMorning && !parts.some((p) => p.includes("morning"))) {
    parts.push("morning");
  }
  if (preference.preferEvening && !parts.some((p) => p.includes("evening"))) {
    parts.push("evening");
  }
  if (preference.preferHighestRated !== false) {
    parts.push("highest-rated");
  }
  return parts.join(", ") || "earliest available";
}
