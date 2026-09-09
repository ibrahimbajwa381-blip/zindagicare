import { useCallback, useState } from "react";
import { Redirect, Stack, useFocusEffect, useRouter } from "expo-router";
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { listChatThreads, type ChatThread } from "@/api/chat";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/config";

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function MessagesScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listChatThreads();
      setThreads(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load messages");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useChatRealtime(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  if (isAuthLoading) {
    return <BrandLoadingScreen />;
  }
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!threads) {
    return (
      <>
        <Stack.Screen options={{ title: "Messages" }} />
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
      <Stack.Screen options={{ title: "Messages" }} />
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.list}
        data={threads}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.hint}>
              No conversations yet. A chat opens automatically once you have a confirmed consultation.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const avatarUri = resolveMediaUrl(item.otherParticipant.avatarUrl);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() =>
                router.push({
                  pathname: "/messages/[threadId]",
                  params: { threadId: item.id, name: item.otherParticipant.name },
                })
              }
              accessibilityRole="button"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{initials(item.otherParticipant.name)}</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.otherParticipant.name}
                  </Text>
                  <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.lastMessagePreview ?? "No messages yet"}
                </Text>
              </View>
              {item.unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular, textAlign: "center" },
  error: { color: "#c62828", fontFamily: fonts.regular },
  list: { padding: 16, gap: 10 },

  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 12, backgroundColor: "#fff", ...cardShadow },
  cardPressed: { opacity: 0.85 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.neutral.muted },
  avatarPlaceholder: { backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.bold, color: colors.brand.mutedForeground, fontSize: 16 },
  cardBody: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  name: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.neutral.foreground, flex: 1 },
  time: { fontFamily: fonts.regular, fontSize: 11, color: "#999" },
  preview: { fontFamily: fonts.regular, fontSize: 13, color: "#888" },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brand.foreground },
});
