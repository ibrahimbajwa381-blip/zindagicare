import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";

export default function RootIndex() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <BrandLoadingScreen />;
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={user.activeWorkspace === "doctor" ? "/(doctor)" : "/(tabs)"} />;
}
