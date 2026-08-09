import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";

/** Content-only — layout keeps sidebar + header mounted during soft navigation. */
export default function PhysiotherapistLoading() {
  return <BrandLoadingScreen message="Loading…" />;
}
