import { Tabs, Redirect, useRouter } from "expo-router";
import { Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/locale-context";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { IconBadge } from "@/components/ui/icon-badge";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts } from "@/lib/theme";

const logo = require("../../assets/logo.png");

type IconName = keyof typeof Ionicons.glyphMap;

function HeaderLogo() {
  return <Image source={logo} resizeMode="contain" style={styles.headerLogo} />;
}

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <Ionicons name={name} size={22} color={focused ? colors.brand.DEFAULT : "#94a3b8"} />
  );
}

export function HeaderActions() {
  const router = useRouter();
  const summary = useUnreadSummary();
  return (
    <>
      <Pressable
        onPress={() => router.push("/messages")}
        hitSlop={8}
        style={styles.headerIcon}
        accessibilityRole="button"
        accessibilityLabel={
          summary?.chatUnreadCount ? `Messages, ${summary.chatUnreadCount} unread` : "Messages"
        }
      >
        <Ionicons name="chatbubbles-outline" size={22} color={colors.neutral.foreground} />
        <IconBadge count={summary?.chatUnreadCount ?? 0} />
      </Pressable>
      <Pressable
        onPress={() => router.push("/notifications")}
        hitSlop={8}
        style={[styles.headerIcon, { marginRight: 4 }]}
        accessibilityRole="button"
        accessibilityLabel={
          summary?.unreadCount ? `Notifications, ${summary.unreadCount} unread` : "Notifications"
        }
      >
        <Ionicons name="notifications-outline" size={22} color={colors.neutral.foreground} />
        <IconBadge count={summary?.unreadCount ?? 0} />
      </Pressable>
    </>
  );
}

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const t = useTranslations();

  if (isLoading) {
    return <BrandLoadingScreen />;
  }

  if (!isLoading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.roles?.includes("doctor")) {
    return <Redirect href="/(doctor)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontFamily: fonts.semibold },
        tabBarActiveTintColor: colors.brand.DEFAULT,
        tabBarInactiveTintColor: "#94a3b8",
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          headerTitle: () => <HeaderLogo />,
          headerTitleAlign: "left",
          headerTitleContainerStyle: { marginLeft: 4 },
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "home" : "home-outline"} focused={focused} />,
          headerRight: () => <HeaderActions />,
        }}
      />
      <Tabs.Screen
        name="doctors"
        options={{
          title: t.tabs.book,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: t.tabs.appointments,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "medkit" : "medkit-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerLogo: { width: 176, height: 40 },
  headerIcon: { marginRight: 16 },
});
