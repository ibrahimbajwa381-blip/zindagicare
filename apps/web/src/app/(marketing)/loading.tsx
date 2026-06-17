import { PageShell } from "@/components/layout/page-shell";
import { LoadingScreen } from "@/components/ui/loading-screen";

export default function MarketingLoading() {
  return (
    <PageShell variant="brand" spacing="lg">
      <LoadingScreen fullScreen size="xl" />
    </PageShell>
  );
}
