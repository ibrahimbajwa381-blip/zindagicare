import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listDoctorHomeVisits, updateDoctorHomeVisitStatus, type DoctorHomeVisit } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";

type Tab = "active" | "history";

const STATUS_COLORS: Record<string, string> = {
  requested: colors.accent.DEFAULT,
  assigned: colors.brand.DEFAULT,
  en_route: colors.brand.DEFAULT,
  arrived: colors.brand.DEFAULT,
  completed: "#16a34a",
  cancelled: "#c62828",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  assigned: "Assigned",
  en_route: "On the way",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

const NEXT_STATUS: Record<string, { key: "en_route" | "arrived" | "completed"; label: string } | undefined> = {
  assigned: { key: "en_route", label: "Mark on the way" },
  en_route: { key: "arrived", label: "Mark arrived" },
  arrived: { key: "completed", label: "Mark completed" },
};

export default function DoctorHomeVisitsScreen() {
  const [tab, setTab] = useState<Tab>("active");
  const [visits, setVisits] = useState<DoctorHomeVisit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (activeTab: Tab) => {
    try {
      const data = await listDoctorHomeVisits(activeTab === "active" ? "assigned" : "assigned-history");
      setVisits(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load home visits");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setVisits(null);
      load(tab);
    }, [load, tab]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load(tab);
    setIsRefreshing(false);
  };

  const advance = (visit: DoctorHomeVisit) => {
    const next = NEXT_STATUS[visit.status];
    if (!next) return;
    setUpdatingId(visit.id);
    updateDoctorHomeVisitStatus(visit.id, next.key)
      .then(() => load(tab))
      .catch((e) => Alert.alert("Couldn't update", e instanceof ApiRequestError ? e.message : "Please try again"))
      .finally(() => setUpdatingId(null));
  };

  const cancel = (visit: DoctorHomeVisit) => {
    Alert.alert("Cancel this visit?", "", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel visit",
        style: "destructive",
        onPress: () => {
          setUpdatingId(visit.id);
          updateDoctorHomeVisitStatus(visit.id, "cancelled")
            .then(() => load(tab))
            .catch((e) => Alert.alert("Couldn't cancel", e instanceof ApiRequestError ? e.message : "Please try again"))
            .finally(() => setUpdatingId(null));
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        {(["active", "history"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "active" ? "Active" : "History"}
            </Text>
          </Pressable>
        ))}
      </View>

      {!visits ? (
        error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : (
          <BrandLoadingScreen />
        )
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={visits}
          keyExtractor={(v) => v.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.hint}>No {tab} home visits.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const next = NEXT_STATUS[item.status];
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.patientName} numberOfLines={1}>
                    {item.patient?.name ?? "Patient"}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[item.status]}1A` }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.address} numberOfLines={2}>
                  {item.address.line}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color="#888" />
                  <Text style={styles.meta}>{formatKarachi(item.scheduledAt)}</Text>
                </View>
                {item.patient?.phone ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="call-outline" size={13} color="#888" />
                    <Text style={styles.meta}>{item.patient.phone}</Text>
                  </View>
                ) : null}
                <Text style={styles.price}>Rs. {item.pricing.total.toLocaleString()}</Text>
                {next ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.primaryButton}
                      onPress={() => advance(item)}
                      disabled={updatingId === item.id}
                      accessibilityRole="button"
                    >
                      <Text style={styles.primaryButtonText}>{next.label}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.cancelButton}
                      onPress={() => cancel(item)}
                      disabled={updatingId === item.id}
                      accessibilityRole="button"
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },

  tabRow: { flexDirection: "row", gap: 8, padding: 16, backgroundColor: colors.neutral.background },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.neutral.muted },
  tabActive: { backgroundColor: colors.brand.DEFAULT },
  tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.neutral.foreground },
  tabTextActive: { color: colors.brand.foreground, fontFamily: fonts.semibold },

  list: { padding: 16, gap: 12 },
  card: { borderRadius: 16, padding: 14, gap: 6, backgroundColor: "#fff", ...cardShadow },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  patientName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground, flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontFamily: fonts.semibold, fontSize: 11 },
  address: { fontFamily: fonts.regular, fontSize: 13, color: "#666" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontFamily: fonts.regular, fontSize: 12.5, color: "#666" },
  price: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brand.mutedForeground, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  primaryButton: { flex: 1, backgroundColor: colors.brand.DEFAULT, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  primaryButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 12.5 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  cancelButtonText: { color: "#c62828", fontFamily: fonts.medium, fontSize: 12.5 },
});
