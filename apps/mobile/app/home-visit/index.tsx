import { useCallback, useState } from "react";
import { Redirect, Stack, useRouter } from "expo-router";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cancelHomeVisit, listMyHomeVisits, type HomeVisitDto } from "@/api/home-visits";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { useFocusLoader } from "@/hooks/use-focus-loader";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";

const STATUS_COLORS: Record<string, string> = {
  requested: colors.accent.DEFAULT,
  assigned: colors.brand.DEFAULT,
  en_route: colors.brand.DEFAULT,
  arrived: colors.brand.DEFAULT,
  completed: "#16a34a",
  cancelled: "#c62828",
};

const SERVICE_LABELS: Record<string, string> = {
  doctor_visit: "Doctor visit",
  nurse: "Nurse care",
  physiotherapy: "Physiotherapy",
  iv_drip: "IV drip",
  injection: "Injection",
  wound_care: "Wound care",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  assigned: "Assigned",
  en_route: "On the way",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function HomeVisitsScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadVisits = useCallback(() => listMyHomeVisits().then((data) => data ?? []), []);
  const { data: visits, error, load } = useFocusLoader(loadVisits, "Failed to load home visits");

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const onCancel = (visit: HomeVisitDto) => {
    Alert.alert("Cancel this request?", "", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel visit",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelHomeVisit(visit.id);
            load();
          } catch (e) {
            Alert.alert("Couldn't cancel", e instanceof ApiRequestError ? e.message : "Please try again");
          }
        },
      },
    ]);
  };

  if (isAuthLoading) {
    return <BrandLoadingScreen />;
  }
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!visits) {
    return (
      <>
        <Stack.Screen options={{ title: "Home visits" }} />
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
      <Stack.Screen options={{ title: "Home visits" }} />
      {error ? <Text style={styles.refreshError}>{error}</Text> : null}
      <FlatList
        testID="home-visits-list"
        contentContainerStyle={styles.list}
        data={visits}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <Pressable style={styles.newButton} onPress={() => router.push("/home-visit/request")} accessibilityRole="button">
            <Text style={styles.newButtonText}>+ Request a home visit</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.hint}>No home visit requests yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.service}>{SERVICE_LABELS[item.serviceType] ?? item.serviceType}</Text>
              <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[item.status] ?? colors.accent.DEFAULT}1A` }]}>
                <Text style={[styles.status, { color: STATUS_COLORS[item.status] ?? colors.accent.DEFAULT }]}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.address} numberOfLines={2}>{item.address.line}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.time}>{formatKarachi(item.scheduledAt)}</Text>
              <Text style={styles.price}>Rs. {item.pricing.total}</Text>
            </View>
            {item.status === "requested" ? (
              <Pressable style={styles.cancelButton} onPress={() => onCancel(item)} accessibilityRole="button">
                <Text style={styles.cancelButtonText}>Cancel request</Text>
              </Pressable>
            ) : null}
          </View>
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
  newButton: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 4,
    ...cardShadow,
  },
  newButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
    backgroundColor: "#fff",
    marginBottom: 12,
    ...cardShadow,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  service: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  status: { fontFamily: fonts.semibold, fontSize: 11 },
  address: { fontFamily: fonts.regular, fontSize: 13, color: "#666" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  time: { fontFamily: fonts.regular, fontSize: 13, color: "#333" },
  price: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brand.mutedForeground },
  cancelButton: { marginTop: 10, alignSelf: "flex-start" },
  cancelButtonText: { color: "#c62828", fontFamily: fonts.medium, fontSize: 13 },
});
