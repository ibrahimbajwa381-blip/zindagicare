import { useCallback, useState } from "react";
import { Stack, useFocusEffect } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from "@/api/notifications";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listNotifications();
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load notifications");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const onOpen = async (item: NotificationDto) => {
    if (item.readAt) return;
    setItems((prev) =>
      prev ? prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)) : prev,
    );
    try {
      await markNotificationRead(item.id);
    } catch {
      // Non-critical — leave it marked read locally even if the sync call fails.
    }
  };

  const onMarkAllRead = async () => {
    setItems((prev) => (prev ? prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) : prev));
    try {
      await markAllNotificationsRead();
    } catch {
      // Non-critical.
    }
  };

  const hasUnread = items?.some((n) => !n.readAt) ?? false;

  if (!items) {
    return (
      <>
        <Stack.Screen options={{ title: "Notifications" }} />
        {error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : (
          <BrandLoadingScreen />
        )}
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerRight: hasUnread
            ? () => (
                <Pressable onPress={onMarkAllRead} hitSlop={8}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="notifications-outline" size={40} color="#ccc" />
            <Text style={styles.hint}>No notifications yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onOpen(item)}>
            {!item.readAt ? <View style={styles.unreadDot} /> : null}
            <View style={styles.cardBody}>
              <Text style={[styles.title, !item.readAt && styles.titleUnread]}>{item.title}</Text>
              <Text style={styles.body} numberOfLines={3}>
                {item.body}
              </Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },
  list: { padding: 16, gap: 10 },
  markAllText: { color: colors.brand.DEFAULT, fontFamily: fonts.medium, fontSize: 13 },
  card: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#fff",
    ...cardShadow,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand.DEFAULT, marginTop: 6 },
  cardBody: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.medium, fontSize: 14, color: colors.neutral.foreground },
  titleUnread: { fontFamily: fonts.semibold },
  body: { fontFamily: fonts.regular, fontSize: 13, color: "#666" },
  time: { fontFamily: fonts.regular, fontSize: 11, color: "#999", marginTop: 2 },
});
