import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listDoctorPrescriptions, type DoctorPrescriptionSummary } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";
import { downloadAndOpenFile } from "@/lib/download-file";

export default function DoctorPrescriptionsScreen() {
  const [items, setItems] = useState<DoctorPrescriptionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listDoctorPrescriptions();
      setItems(data);
      setError(null);
    } catch (e) {
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

  const onDownload = async (item: DoctorPrescriptionSummary) => {
    setDownloadingId(item.id);
    try {
      await downloadAndOpenFile(item.downloadUrl, `${item.patientName.replace(/\s+/g, "-")}-prescription.pdf`);
    } catch (e) {
      Alert.alert("Couldn't open prescription", e instanceof Error ? e.message : "Please try again");
    } finally {
      setDownloadingId(null);
    }
  };

  if (!items) {
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
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.hint}>No prescriptions written yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => onDownload(item)}
          disabled={downloadingId === item.id}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="document-text-outline" size={22} color={colors.brand.mutedForeground} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.patient} numberOfLines={1}>
              {item.patientName}
            </Text>
            <Text style={styles.meta}>{formatKarachi(item.issuedAt)}</Text>
            <Text style={styles.meta}>
              {item.medicationCount} {item.medicationCount === 1 ? "medicine" : "medicines"}
            </Text>
          </View>
          {downloadingId === item.id ? (
            <Ionicons name="hourglass-outline" size={18} color="#ccc" />
          ) : (
            <Ionicons name="download-outline" size={20} color="#ccc" />
          )}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },
  list: { padding: 16, gap: 12 },
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
  cardBody: { flex: 1, gap: 2 },
  patient: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },
});
