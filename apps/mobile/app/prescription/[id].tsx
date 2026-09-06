import { useEffect, useState } from "react";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getPrescriptionDetail, type PrescriptionDetail } from "@/api/prescriptions";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";
import { downloadAndOpenFile } from "@/lib/download-file";

export default function PrescriptionDetailScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<PrescriptionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    getPrescriptionDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "Failed to load prescription"));
  }, [id]);

  const onDownload = async () => {
    if (!detail) return;
    setIsDownloading(true);
    try {
      await downloadAndOpenFile(detail.downloadUrl, `${detail.doctorName.replace(/\s+/g, "-")}-prescription.pdf`);
    } catch (e) {
      Alert.alert("Couldn't open prescription", e instanceof Error ? e.message : "Please try again");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isAuthLoading) {
    return <BrandLoadingScreen />;
  }
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!detail) {
    return (
      <>
        <Stack.Screen options={{ title: "Prescription" }} />
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
      <Stack.Screen options={{ title: "Prescription" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Prescribed by</Text>
          <Text style={styles.doctor}>{detail.doctorName}</Text>
          <Text style={styles.meta}>{formatKarachi(detail.issuedAt)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Medicines</Text>
          {detail.medications.map((med, i) => (
            <View key={i} style={[styles.medRow, i > 0 && styles.medRowBorder]}>
              <Text style={styles.medName}>{med.name}</Text>
              <Text style={styles.medDetail}>
                {med.dosage} · {med.frequency} · {med.duration}
              </Text>
            </View>
          ))}
        </View>

        {detail.notes ? (
          <View style={styles.card}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.notes}>{detail.notes}</Text>
          </View>
        ) : null}

        <Pressable style={styles.primaryButton} onPress={onDownload} disabled={isDownloading} accessibilityRole="button">
          {isDownloading ? (
            <Spinner size="sm" color={colors.brand.foreground} />
          ) : (
            <Text style={styles.primaryButtonText}>Download / Share PDF</Text>
          )}
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  error: { color: "#c62828", fontFamily: fonts.regular },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 4,
    ...cardShadow,
  },
  label: { fontFamily: fonts.medium, fontSize: 12, color: "#888", textTransform: "uppercase" },
  doctor: { fontFamily: fonts.semibold, fontSize: 17, color: colors.neutral.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: "#666" },
  medRow: { paddingVertical: 10, gap: 2 },
  medRowBorder: { borderTopWidth: 1, borderTopColor: colors.neutral.border },
  medName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  medDetail: { fontFamily: fonts.regular, fontSize: 13, color: "#666" },
  notes: { fontFamily: fonts.regular, fontSize: 14, color: colors.neutral.foreground, lineHeight: 20 },
  primaryButton: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
});
