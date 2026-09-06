import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listDoctorRequests, type DoctorRequestOutcome, type DoctorRequestRow } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";

const POLL_MS = 15_000;

type FilterKey = "active" | "completed" | "missed" | "cancelled" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "missed", label: "Missed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const OUTCOME_COLORS: Record<DoctorRequestOutcome, string> = {
  upcoming: colors.accent.DEFAULT,
  in_progress: colors.brand.DEFAULT,
  pending: "#F5A623",
  completed: "#16a34a",
  missed: "#c62828",
  cancelled: "#888",
};

const OUTCOME_LABELS: Record<DoctorRequestOutcome, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  pending: "Pending",
  completed: "Completed",
  missed: "Missed",
  cancelled: "Cancelled",
};

const TYPE_LABELS: Record<string, string> = {
  online: "Video consult",
  clinic: "Clinic visit",
  urgent_online: "Urgent consult",
  sunday_free: "Sunday free consult",
};

function matchesFilter(outcome: DoctorRequestOutcome, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "active") return outcome === "upcoming" || outcome === "in_progress" || outcome === "pending";
  return outcome === filter;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function canWritePrescription(item: DoctorRequestRow) {
  return !item.hasPrescription && (item.outcome === "completed" || item.outcome === "in_progress" || item.outcome === "upcoming");
}

export default function DoctorRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<DoctorRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("active");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestRequestIdRef = useRef(0);

  const load = useCallback(async (silent = false) => {
    const requestId = ++latestRequestIdRef.current;
    try {
      const data = await listDoctorRequests();
      if (requestId !== latestRequestIdRef.current) return; // a newer load() already landed
      setRequests(data ?? []);
      setError(null);
    } catch (e) {
      if (requestId !== latestRequestIdRef.current) return;
      if (!silent) setError(e instanceof ApiRequestError ? e.message : "Failed to load requests");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      pollRef.current = setInterval(() => load(true), POLL_MS);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const filtered = useMemo(
    () => (requests ?? []).filter((r) => matchesFilter(r.outcome, filter)),
    [requests, filter],
  );

  if (!requests) {
    return error ? (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    ) : (
      <BrandLoadingScreen />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          renderItem={({ item }) => {
            const active = item.key === filter;
            return (
              <Pressable
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {error ? <Text style={styles.refreshError}>{error}</Text> : null}
      <FlatList
        testID="requests-list"
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.hint}>No {filter === "all" ? "" : filter} consult requests.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.patientName} numberOfLines={1}>
                {item.patient.name}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: `${OUTCOME_COLORS[item.outcome]}1A` }]}>
                <Text style={[styles.statusText, { color: OUTCOME_COLORS[item.outcome] }]}>
                  {OUTCOME_LABELS[item.outcome]}
                </Text>
              </View>
            </View>
            <Text style={styles.type}>{TYPE_LABELS[item.type] ?? item.type}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color="#888" />
              <Text style={styles.meta}>{formatDateTime(item.scheduledStart)}</Text>
            </View>
            {item.patient.phone ? (
              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={13} color="#888" />
                <Text style={styles.meta}>{item.patient.phone}</Text>
              </View>
            ) : null}
            {item.patientNotes ? (
              <Text style={styles.notes} numberOfLines={3}>
                “{item.patientNotes}”
              </Text>
            ) : null}
            <View style={styles.footerRow}>
              {item.consultationFee != null ? (
                <Text style={styles.fee}>Rs. {item.consultationFee.toLocaleString()}</Text>
              ) : null}
              {item.hasPrescription ? (
                <View style={styles.tag}>
                  <Ionicons name="document-text-outline" size={12} color={colors.brand.mutedForeground} />
                  <Text style={styles.tagText}>Prescribed</Text>
                </View>
              ) : null}
              {item.canJoin ? (
                <View style={[styles.tag, styles.joinTag]}>
                  <Ionicons name="videocam-outline" size={12} color={colors.brand.mutedForeground} />
                  <Text style={styles.tagText}>Join on website</Text>
                </View>
              ) : null}
            </View>
            {item.review ? (
              <View style={styles.reviewRow}>
                <View style={{ flexDirection: "row" }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ionicons
                      key={i}
                      name={i < item.review!.rating ? "star" : "star-outline"}
                      size={13}
                      color="#F5A623"
                    />
                  ))}
                </View>
                {item.review.comment ? (
                  <Text style={styles.reviewComment} numberOfLines={2}>
                    {item.review.comment}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.cardActions}>
              {item.type !== "urgent_online" ? (
                <Pressable
                  style={styles.secondaryAction}
                  onPress={() => router.push({ pathname: "/(doctor)/intake", params: { appointmentId: item.id } })}
                  accessibilityRole="button"
                >
                  <Ionicons name="clipboard-outline" size={14} color={colors.neutral.foreground} />
                  <Text style={styles.secondaryActionText}>Intake</Text>
                </Pressable>
              ) : null}
              {canWritePrescription(item) ? (
                <Pressable
                  style={styles.prescribeButton}
                  onPress={() => router.push({ pathname: "/(doctor)/prescription-new", params: { appointmentId: item.id } })}
                  accessibilityRole="button"
                >
                  <Ionicons name="document-text-outline" size={14} color={colors.brand.foreground} />
                  <Text style={styles.prescribeButtonText}>Write prescription</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },
  refreshError: { color: "#c62828", fontFamily: fonts.regular, fontSize: 12, textAlign: "center", paddingVertical: 6, backgroundColor: colors.neutral.background },

  filterRow: { paddingVertical: 12, backgroundColor: colors.neutral.background },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.neutral.muted,
  },
  filterChipActive: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  filterChipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.neutral.foreground },
  filterChipTextActive: { color: colors.brand.foreground, fontFamily: fonts.semibold },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 6,
    ...cardShadow,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  patientName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground, flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontFamily: fonts.semibold, fontSize: 11 },
  type: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.accent.DEFAULT },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontFamily: fonts.regular, fontSize: 12.5, color: "#666" },
  notes: { fontFamily: fonts.regular, fontSize: 12.5, color: "#555", fontStyle: "italic", marginTop: 2 },
  footerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 },
  fee: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brand.mutedForeground },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand.muted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  joinTag: { backgroundColor: colors.accent.muted },
  tagText: { fontFamily: fonts.medium, fontSize: 11, color: colors.brand.mutedForeground },
  reviewRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    gap: 4,
  },
  reviewComment: { fontFamily: fonts.regular, fontSize: 12.5, color: "#555" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.neutral.muted,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  secondaryActionText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.neutral.foreground },
  prescribeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 9,
    borderRadius: 10,
  },
  prescribeButtonText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.brand.foreground },
});
