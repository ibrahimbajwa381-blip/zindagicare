"use client";

import Link from "next/link";
import { Video } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { videoConsultPath } from "@/features/consult/paths";
import { useVideoJoinWindow } from "@/features/consult/hooks/use-video-join-window";
import { useTranslations } from "@/i18n/locale-provider";

type Props = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  iconClassName?: string;
  /** Urgent care — joinable while the consult is still active. */
  urgent?: boolean;
  /** Sunday free consult — joinable until the doctor finishes it. */
  openUntilClosed?: boolean;
  /** Show only the camera icon; the label becomes the accessible name. */
  iconOnly?: boolean;
};

export function VideoJoinLinkButton({
  appointmentId,
  scheduledStart,
  scheduledEnd,
  label,
  size = "default",
  className,
  iconClassName = "h-3.5 w-3.5",
  urgent = false,
  openUntilClosed = false,
  iconOnly = false,
}: Props) {
  const t = useTranslations();
  const { canJoin } = useVideoJoinWindow(scheduledStart, scheduledEnd, openUntilClosed);
  const buttonLabel = label ?? t.consult.videoSession.joinVideo;

  if (!urgent && !canJoin) return null;

  return (
    <Button size={size} asChild className={cn("gap-1", className)}>
      <Link
        href={videoConsultPath(appointmentId)}
        aria-label={iconOnly ? buttonLabel : undefined}
        title={iconOnly ? buttonLabel : undefined}
      >
        <Video className={iconClassName} aria-hidden={iconOnly || undefined} />
        {!iconOnly && buttonLabel}
      </Link>
    </Button>
  );
}
