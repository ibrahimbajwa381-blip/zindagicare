"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finishConsult } from "@/features/consult/finish-consult";
import { videoConsultPath } from "@/features/consult/paths";
import { useTranslations } from "@/i18n/locale-provider";

/**
 * Finish action for any open online consult. Providers get a refresh on success;
 * patients (`asPatient`) go straight to rating the doctor and ZindagiCare.
 */
export function FinishConsultButton({
  appointmentId,
  asPatient = false,
  size = "sm",
}: {
  appointmentId: string;
  asPatient?: boolean;
  size?: "sm" | "default";
}) {
  const videoCopy = useTranslations().consult.videoSession;
  const copy = asPatient ? videoCopy.patientOpen : videoCopy.doctorOpen;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async () => {
    if (!window.confirm(copy.confirm)) return;
    setBusy(true);
    setError(null);
    const message = await finishConsult(appointmentId);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    if (asPatient) {
      // Full load: the video page may already be on this URL with the consult cached as open.
      window.location.href = `${videoConsultPath(appointmentId)}?left=1`;
      return;
    }
    router.refresh();
  };

  return (
    <>
      <Button size={size} className="gap-1.5" onClick={() => void onFinish()} disabled={busy} loading={busy}>
        <CheckCircle2 className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {copy.finish}
      </Button>
      {error ? (
        <p role="alert" className="basis-full text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </>
  );
}
