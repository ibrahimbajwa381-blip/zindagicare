import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";

/** Content-only — layout keeps sidebar + header mounted during soft navigation. */
export default function NutritionistLoading() {
  return <BrandLoadingScreen message="Loading…" />;
}
