import { useEffect, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { getAppointmentIntakeForDoctor, type MedicalIntake } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";

export default function DoctorIntakeScreen() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const [intake, setIntake] = useState<MedicalIntake | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAppointmentIntakeForDoctor(appointmentId)
      .then(setIntake)
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "Failed to load intake"));
  }, [appointmentId]);

  if (intake === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Patient intake" }} />
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

  if (!intake) {
    return (
      <>
        <Stack.Screen options={{ title: "Patient intake" }} />
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={32} color="#ccc" />
          <Text style={styles.hint}>No intake responses for this appointment.</Text>
        </View>
      </>
    );
  }

  const answered = intake.questions.filter((q) => q.answer);

  return (
    <>
      <Stack.Screen options={{ title: "Patient intake" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{intake.status.replace("_", " ")}</Text>
        </View>
        {answered.length === 0 ? (
          <Text style={styles.hint}>Patient hasn't answered any intake questions yet.</Text>
        ) : (
          answered.map((q) => (
            <View key={q.key} style={styles.card}>
              <Text style={styles.question}>{q.text}</Text>
              <Text style={styles.answer}>{q.answer}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  hint: { color: "#666", fontFamily: fonts.regular, textAlign: "center" },
  error: { color: "#c62828", fontFamily: fonts.regular },

  statusRow: { alignSelf: "flex-start" },
  statusText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.brand.mutedForeground,
    backgroundColor: colors.brand.muted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    textTransform: "capitalize",
    overflow: "hidden",
  },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 6, ...cardShadow },
  question: { fontFamily: fonts.medium, fontSize: 12.5, color: "#888" },
  answer: { fontFamily: fonts.regular, fontSize: 14.5, color: colors.neutral.foreground, lineHeight: 20 },
});
