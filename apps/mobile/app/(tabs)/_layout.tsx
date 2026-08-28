import { Tabs, Redirect, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { colors, fonts } from "@/lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <Ionicons name={name} size={22} color={focused ? colors.brand.DEFAULT : "#94a3b8"} />
  );
}

function NotificationsButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/notifications")} hitSlop={8} style={{ marginRight: 4 }}>
      <Ionicons name="notifications-outline" size={22} color={colors.neutral.foreground} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const { user, isLoading } = useAuth();

  if (!isLoading && !user) {
    return <Redirect href="/(auth)/login" />;
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
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "home" : "home-outline"} focused={focused} />,
          headerRight: () => <NotificationsButton />,
        }}
      />
      <Tabs.Screen
        name="doctors"
        options={{
          title: "Book",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Appointments",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "medkit" : "medkit-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
