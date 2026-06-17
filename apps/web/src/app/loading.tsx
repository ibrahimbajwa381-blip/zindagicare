import { LoadingScreen } from "@/components/ui/loading-screen";

export default function RootLoading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-brand-muted via-white to-accent-muted">
      <LoadingScreen fullScreen size="xl" />
    </div>
  );
}
