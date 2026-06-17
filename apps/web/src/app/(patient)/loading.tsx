import { PageShell } from "@/components/layout/page-shell";
import { LoadingScreen } from "@/components/ui/loading-screen";

export default function PatientLoading() {
  return (
    <PageShell variant="brand" spacing="default" flipBlur>
      <LoadingScreen fullScreen size="xl" />
    </PageShell>
  );
}
