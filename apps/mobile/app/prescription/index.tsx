import { useCallback, useRef, useState } from "react";
import { Redirect, Stack, useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listPrescriptions, type PrescriptionSummary } from "@/api/prescriptions";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";

export default function PrescriptionsScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PrescriptionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const latestRequestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    try {
      const data = await listPrescriptions();
      if (requestId !== latestRequestIdRef.current) return; // a newer load() already landed
      setItems(data ?? []);
      setError(null);
    } catch (e) {
      if (requestId !== latestRequestIdRef.current) return;
      setError(e instanceof ApiRequestError ? e.message : "Failed to load prescriptions");
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

  if (isAuthLoading) {
    return <BrandLoadingScreen />;
  }
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!items) {
    return (
      <>
        <Stack.Screen options={{ title: "Prescriptions" }} />
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
      <Stack.Screen options={{ title: "Prescriptions" }} />
      {error ? <Text style={styles.refreshError}>{error}</Text> : null}
      <FlatList
        testID="prescriptions-list"
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.hint}>No prescriptions yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push({ pathname: "/prescription/[id]", params: { id: item.id } })}
            accessibilityRole="button"
          >
            <View style={styles.iconWrap}>
              <Ionicons name="document-text-outline" size={22} color={colors.brand.mutedForeground} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.doctor} numberOfLines={1}>
                {item.doctorName}
              </Text>
              <Text style={styles.meta}>{formatKarachi(item.issuedAt)}</Text>
              <Text style={styles.meta}>
                {item.medicationCount} {item.medicationCount === 1 ? "medicine" : "medicines"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },
  refreshError: { color: "#c62828", fontFamily: fonts.regular, fontSize: 12, textAlign: "center", paddingVertical: 6, backgroundColor: colors.neutral.background },
  list: { padding: 16, gap: 12, backgroundColor: colors.neutral.muted },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#fff",
    ...cardShadow,
  },
  cardPressed: { opacity: 0.85 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brand.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontFamily: fonts.bold, fontSize: 15, color: colors.brand.mutedForeground },
  cardBody: { flex: 1, gap: 2 },
  doctor: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },
  chevron: { fontSize: 22, color: "#ccc", fontFamily: fonts.regular },
});
