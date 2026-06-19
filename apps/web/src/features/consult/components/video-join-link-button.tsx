"use client";

import Link from "next/link";
import { Video } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { videoConsultPath } from "@/features/consult/paths";
import { useVideoJoinWindow } from "@/features/consult/hooks/use-video-join-window";

type Props = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  iconClassName?: string;
};

export function VideoJoinLinkButton({
  appointmentId,
  scheduledStart,
  scheduledEnd,
  label = "Join video",
  size = "default",
  className,
  iconClassName = "h-3.5 w-3.5",
}: Props) {
  const { canJoin } = useVideoJoinWindow(scheduledStart, scheduledEnd);

  if (!canJoin) return null;

  return (
    <Button size={size} asChild className={cn("gap-1", className)}>
      <Link href={videoConsultPath(appointmentId)}>
        <Video className={iconClassName} />
        {label}
      </Link>
    </Button>
  );
}
