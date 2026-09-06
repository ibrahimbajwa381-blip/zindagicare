import { useEffect, useState } from "react";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { getPatientIntake, submitPatientIntakeForm, type MedicalIntake } from "@/api/intake";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";

export default function IntakeFormScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const router = useRouter();
  const [intake, setIntake] = useState<MedicalIntake | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getPatientIntake(appointmentId)
      .then((dto) => {
        setIntake(dto);
        setAnswers(Object.fromEntries(dto.questions.map((q) => [q.key, q.answer ?? ""])));
      })
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "Failed to load medical history form"));
  }, [appointmentId]);

  const submit = async () => {
    if (!intake) return;
    const filled = intake.questions.map((q) => ({ key: q.key, answer: (answers[q.key] ?? "").trim() }));
    if (filled.some((a) => !a.answer)) {
      Alert.alert("Answer required", "Please answer every question before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await submitPatientIntakeForm(appointmentId, filled);
      Alert.alert("Thanks!", "Your medical history has been shared with your doctor.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : "Failed to submit";
      setError(message);
      Alert.alert("Couldn't submit", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return <BrandLoadingScreen />;
  }
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!intake) {
    return (
      <>
        <Stack.Screen options={{ title: "Medical history" }} />
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

  if (intake.status === "completed") {
    return (
      <>
        <Stack.Screen options={{ title: "Medical history" }} />
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
          <Text style={styles.hint}>You've already shared your medical history for this consultation.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Medical history" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Help your doctor prepare by answering a few quick questions before your consultation.
        </Text>
        {intake.questions.map((q) => (
          <View key={q.key} style={styles.card}>
            <Text style={styles.question}>{q.text}</Text>
            <TextInput
              style={styles.input}
              value={answers[q.key] ?? ""}
              onChangeText={(v) => setAnswers((prev) => ({ ...prev, [q.key]: v }))}
              multiline
              placeholder="Your answer"
              placeholderTextColor="#9AA5B1"
              accessibilityLabel={q.text}
            />
          </View>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.submitButton} onPress={submit} disabled={isSubmitting} accessibilityRole="button">
          {isSubmitting ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.submitButtonText}>Submit</Text>}
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  hint: { color: "#666", fontFamily: fonts.regular, textAlign: "center" },
  error: { color: "#c62828", fontFamily: fonts.regular },
  intro: { fontFamily: fonts.regular, fontSize: 13, color: "#666", lineHeight: 19, marginBottom: 4 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10, ...cardShadow },
  question: { fontFamily: fonts.semibold, fontSize: 14, color: colors.neutral.foreground },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 60,
    textAlignVertical: "top",
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },

  submitButton: { backgroundColor: colors.brand.DEFAULT, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  submitButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
});
