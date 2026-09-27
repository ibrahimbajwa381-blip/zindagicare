import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { listDoctorPatients } from "@/api/doctor";
import { useFocusLoader } from "@/hooks/use-focus-loader";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachiDate } from "@/lib/format-date";

function formatDate(iso?: string) {
  if (!iso) return undefined;
  return formatKarachiDate(iso);
}

const OUTCOME_COLORS: Record<string, string> = {
  upcoming: colors.accent.DEFAULT,
  in_progress: colors.brand.DEFAULT,
  pending: "#F5A623",
  completed: "#16a34a",
  missed: "#c62828",
  cancelled: "#888",
};

export default function DoctorPatientsScreen() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadPatients = useCallback(() => listDoctorPatients().then((data) => data ?? []), []);
  const { data: patients, error, load } = useFocusLoader(loadPatients, "Failed to load patients");

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  if (!patients) {
    return error ? (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    ) : (
      <BrandLoadingScreen />
    );
  }

  return (
    <FlatList
      testID="patients-list"
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={patients}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={error ? <Text style={styles.refreshError}>{error}</Text> : null}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.hint}>No patients yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: `${OUTCOME_COLORS[item.lastOutcome] ?? "#888"}1A` }]}>
              <Text style={[styles.statusText, { color: OUTCOME_COLORS[item.lastOutcome] ?? "#888" }]}>
                {item.lastOutcome.replace("_", " ")}
              </Text>
            </View>
          </View>
          {item.phone ? (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={13} color="#888" />
              <Text style={styles.meta}>{item.phone}</Text>
            </View>
          ) : null}
          {item.lastVisitAt ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color="#888" />
              <Text style={styles.meta}>Last visit: {formatDate(item.lastVisitAt)}</Text>
            </View>
          ) : null}
          <View style={styles.statsRow}>
            <Text style={styles.statChip}>{item.appointmentCount} visits</Text>
            <Text style={styles.statChip}>{item.completedCount} completed</Text>
            <Text style={styles.statChip}>{item.prescriptionCount} prescriptions</Text>
          </View>
          {item.review ? (
            <View style={styles.reviewRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < item.review!.rating ? "star" : "star-outline"}
                  size={13}
                  color="#F5A623"
                />
              ))}
              {item.review.comment ? (
                <Text style={styles.reviewComment} numberOfLines={2}>
                  {item.review.comment}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },
  refreshError: { color: "#c62828", fontFamily: fonts.regular, fontSize: 12, textAlign: "center", paddingVertical: 6, backgroundColor: colors.neutral.background },
  list: { padding: 16, gap: 12 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, gap: 6, ...cardShadow },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground, flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontFamily: fonts.semibold, fontSize: 11, textTransform: "capitalize" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontFamily: fonts.regular, fontSize: 12.5, color: "#666" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  statChip: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.brand.mutedForeground,
    backgroundColor: colors.brand.muted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  reviewComment: { fontFamily: fonts.regular, fontSize: 12.5, color: "#555", flexShrink: 1 },
});
