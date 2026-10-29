"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finishConsult } from "@/features/consult/finish-consult";
import { useTranslations } from "@/i18n/locale-provider";

/** Provider's Finish action for any open online consult; refreshes server data on success. */
export function FinishConsultButton({ appointmentId }: { appointmentId: string }) {
  const copy = useTranslations().consult.videoSession.doctorOpen;
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
    router.refresh();
  };

  return (
    <>
      <Button size="sm" className="gap-1" onClick={() => void onFinish()} disabled={busy} loading={busy}>
        <CheckCircle2 className="h-3.5 w-3.5" />
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
