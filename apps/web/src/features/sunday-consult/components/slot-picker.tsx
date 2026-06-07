"use client";

import { SlotStatuses } from "@zindagi/shared";
import { cn } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { formatKarachiTime } from "@/lib/format/datetime";
import { useMounted } from "@/hooks/use-mounted";
import { surfaceInset } from "@/lib/ui/surfaces";

export type SlotView = {
  slotId: string;
  startAt: string;
  endAt: string;
  status: string;
};

type Props = {
  slots: SlotView[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
};

export function SlotPicker({ slots, selectedSlotId, onSelect, disabled, emptyMessage }: Props) {
  const mounted = useMounted();

  if (!slots.length) {
    return (
      <p className="text-sm text-slate-500">
        {emptyMessage ?? "No slots available for this Sunday."}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
      {slots.map((slot) => {
        const available = slot.status === SlotStatuses.AVAILABLE;
        const selected = selectedSlotId === slot.slotId;
        const time = mounted ? formatKarachiTime(slot.startAt) : "…";

        return (
          <button
            key={slot.slotId}
            type="button"
            disabled={disabled || !available}
            onClick={() => available && onSelect(slot.slotId)}
            className={cn(
              "min-h-11 rounded-xl px-3 py-2.5 text-sm text-foreground transition-all active:scale-[0.98]",
              surfaceInset,
              available && "hover:border-brand-light hover:bg-brand-muted/80",
              selected && "border-brand bg-brand-muted ring-2 ring-brand/30",
              !available && "cursor-not-allowed opacity-50",
            )}
          >
            <div className="font-medium">{time}</div>
            {!available && (
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {slot.status}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
