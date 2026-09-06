import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { completeDoctorUrgentCall, listDoctorUrgentCalls, type DoctorUrgentCall } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { useFocusLoader } from "@/hooks/use-focus-loader";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";

const POLL_MS = 15_000;

export default function DoctorUrgentCallsScreen() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const loadCalls = useCallback(() => listDoctorUrgentCalls().then((data) => data ?? []), []);
  const { data: calls, error, load } = useFocusLoader(loadCalls, "Failed to load urgent calls", {
    pollMs: POLL_MS,
  });

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const markComplete = (call: DoctorUrgentCall) => {
    Alert.alert("Mark this call as completed?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark completed",
        onPress: async () => {
          setCompletingId(call.requestId);
          try {
            await completeDoctorUrgentCall(call.requestId);
            await load();
          } catch (e) {
            Alert.alert("Couldn't update", e instanceof ApiRequestError ? e.message : "Please try again");
          } finally {
            setCompletingId(null);
          }
        },
      },
    ]);
  };

  if (!calls) {
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
      testID="urgent-calls-list"
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={calls}
      keyExtractor={(item) => item.requestId}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={error ? <Text style={styles.refreshError}>{error}</Text> : null}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Ionicons name="pulse-outline" size={32} color="#ccc" />
          <Text style={styles.hint}>No urgent calls assigned right now.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.patientName} numberOfLines={1}>
              {item.patientName}
            </Text>
            {item.feePkr != null ? <Text style={styles.fee}>Rs. {item.feePkr.toLocaleString()}</Text> : null}
          </View>
          {item.scheduledStart ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color="#888" />
              <Text style={styles.meta}>{formatKarachi(item.scheduledStart)}</Text>
            </View>
          ) : null}
          {item.patientPhone ? (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={13} color="#888" />
              <Text style={styles.meta}>{item.patientPhone}</Text>
            </View>
          ) : null}
          {item.patientNotes ? (
            <Text style={styles.notes} numberOfLines={3}>
              “{item.patientNotes}”
            </Text>
          ) : null}
          <View style={styles.footerRow}>
            <View style={styles.joinTag}>
              <Ionicons name="videocam-outline" size={12} color={colors.brand.mutedForeground} />
              <Text style={styles.joinTagText}>Join on website</Text>
            </View>
            <Pressable
              style={styles.completeButton}
              onPress={() => markComplete(item)}
              disabled={completingId === item.requestId}
              accessibilityRole="button"
            >
              {completingId === item.requestId ? (
                <Spinner size="sm" color={colors.brand.foreground} />
              ) : (
                <Text style={styles.completeButtonText}>Mark completed</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },
  refreshError: { color: "#c62828", fontFamily: fonts.regular, fontSize: 12, textAlign: "center", paddingVertical: 6, backgroundColor: colors.neutral.background },
  list: { padding: 16, gap: 12 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, gap: 6, ...cardShadow },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  patientName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground, flex: 1 },
  fee: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brand.mutedForeground },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontFamily: fonts.regular, fontSize: 12.5, color: "#666" },
  notes: { fontFamily: fonts.regular, fontSize: 12.5, color: "#555", fontStyle: "italic", marginTop: 2 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
  joinTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent.muted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  joinTagText: { fontFamily: fonts.medium, fontSize: 11, color: colors.brand.mutedForeground },
  completeButton: { backgroundColor: colors.brand.DEFAULT, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  completeButtonText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.brand.foreground },
});
