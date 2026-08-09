import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";

/** Content-only — layout keeps sidebar + header mounted during soft navigation. */
export default function NurseLoading() {
  return <BrandLoadingScreen message="Loading…" />;
}
