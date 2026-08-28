import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";

export default function RootIndex() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <BrandLoadingScreen />;
  }

  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}
