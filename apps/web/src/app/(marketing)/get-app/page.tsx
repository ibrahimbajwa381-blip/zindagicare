import { Suspense } from "react";
import { GetAppPage } from "@/features/pwa/components/get-app-page";
import { LoadingScreen } from "@/components/ui/loading-screen";

export const metadata = {
  title: "Get the app",
  description:
    "Install ZindagiCare on Android or iPhone for quick access to doctors, urgent care, and home visits.",
};

export default function GetAppRoutePage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading install guide…" />}>
      <GetAppPage />
    </Suspense>
  );
}
