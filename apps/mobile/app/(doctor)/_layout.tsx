import { Tabs, Redirect, useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { IconBadge } from "@/components/ui/icon-badge";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts } from "@/lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return <Ionicons name={name} size={22} color={focused ? colors.brand.DEFAULT : "#94a3b8"} />;
}

export function HeaderActions() {
  const router = useRouter();
  const summary = useUnreadSummary();
  return (
    <>
      <Pressable
        onPress={() => router.push("/(doctor)/messages")}
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

export default function DoctorLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <BrandLoadingScreen />;
  }

  if (!isLoading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user && !user.roles?.includes("doctor")) {
    return <Redirect href="/(tabs)" />;
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
          title: "Dashboard",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "grid" : "grid-outline"} focused={focused} />,
          headerRight: () => <HeaderActions />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "person" : "person-outline"} focused={focused} />,
        }}
      />
      <Tabs.Screen name="profile-edit" options={{ href: null, title: "Edit profile" }} />
      <Tabs.Screen name="earnings" options={{ href: null, title: "Earnings" }} />
      <Tabs.Screen name="patients" options={{ href: null, title: "Patients" }} />
      <Tabs.Screen name="referrals" options={{ href: null, title: "Referrals" }} />
      <Tabs.Screen name="prescriptions" options={{ href: null, title: "Prescriptions" }} />
      <Tabs.Screen name="prescription-new" options={{ href: null, title: "Write prescription" }} />
      <Tabs.Screen name="verification" options={{ href: null, title: "Verification" }} />
      <Tabs.Screen name="urgent-calls" options={{ href: null, title: "Urgent calls" }} />
      <Tabs.Screen name="sunday-consult" options={{ href: null, title: "Sunday free consult" }} />
      <Tabs.Screen name="home-visits" options={{ href: null, title: "Home visits" }} />
      <Tabs.Screen name="messages" options={{ href: null, title: "Messages" }} />
      <Tabs.Screen name="messages-thread" options={{ href: null, title: "Conversation" }} />
      <Tabs.Screen name="intake" options={{ href: null, title: "Patient intake" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerIcon: { marginRight: 16 },
});
