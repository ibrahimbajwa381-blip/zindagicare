import { useEffect, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import {
  createDoctorPrescription,
  getDoctorPrescriptionContext,
  type DoctorPrescriptionContext,
} from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";

type Medication = { name: string; dosage: string; frequency: string; duration: string };

const EMPTY_MED: Medication = { name: "", dosage: "", frequency: "", duration: "" };

export default function DoctorPrescriptionNewScreen() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const router = useRouter();
  const [context, setContext] = useState<DoctorPrescriptionContext | null>(null);
  const [medications, setMedications] = useState<Medication[]>([{ ...EMPTY_MED }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    getDoctorPrescriptionContext(appointmentId)
      .then(setContext)
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "Failed to load appointment"));
  }, [appointmentId]);

  const updateMed = (index: number, patch: Partial<Medication>) => {
    setMedications((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const addMed = () => setMedications((prev) => [...prev, { ...EMPTY_MED }]);
  const removeMed = (index: number) => setMedications((prev) => prev.filter((_, i) => i !== index));

  const submit = async () => {
    if (isSavingRef.current) return;
    const cleaned = medications
      .map((m) => ({
        name: m.name.trim(),
        dosage: m.dosage.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim(),
      }))
      .filter((m) => m.name);

    if (cleaned.length === 0) {
      Alert.alert("Add a medicine", "At least one medicine with a name is required.");
      return;
    }
    if (cleaned.some((m) => !m.dosage || !m.frequency || !m.duration)) {
      Alert.alert("Missing details", "Each medicine needs a dosage, frequency, and duration.");
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await createDoctorPrescription({ appointmentId, medications: cleaned, notes: notes.trim() || undefined });
      router.replace("/(doctor)/prescriptions");
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : "Failed to save prescription";
      setError(message);
      Alert.alert("Couldn't save prescription", message);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  if (!context) {
    return (
      <>
        <Stack.Screen options={{ title: "Write prescription" }} />
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

  if (context.existingPrescription) {
    return (
      <>
        <Stack.Screen options={{ title: "Write prescription" }} />
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
          <Text style={styles.hint}>A prescription was already issued for this consultation.</Text>
        </View>
      </>
    );
  }

  if (!context.canIssue) {
    return (
      <>
        <Stack.Screen options={{ title: "Write prescription" }} />
        <View style={styles.centered}>
          <Text style={styles.hint}>
            Prescriptions can only be issued for confirmed, in-progress, or completed appointments.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Write prescription" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.patient}>{context.patientName}</Text>
          <Text style={styles.meta}>
            {context.appointmentType} · {formatKarachi(context.scheduledStart)}
          </Text>
        </View>

        {medications.map((med, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.medHeader}>
              <Text style={styles.medTitle}>Medicine {i + 1}</Text>
              {medications.length > 1 ? (
                <Pressable
                  testID={`remove-medicine-${i}`}
                  onPress={() => removeMed(i)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove medicine ${i + 1}`}
                >
                  <Ionicons name="trash-outline" size={18} color="#c62828" />
                </Pressable>
              ) : null}
            </View>
            <TextInput
              style={styles.input}
              value={med.name}
              onChangeText={(v) => updateMed(i, { name: v })}
              placeholder="Medicine name"
              placeholderTextColor="#9AA5B1"
              accessibilityLabel={`Medicine ${i + 1} name`}
            />
            <TextInput
              style={styles.input}
              value={med.dosage}
              onChangeText={(v) => updateMed(i, { dosage: v })}
              placeholder="Dosage (e.g. 500mg)"
              placeholderTextColor="#9AA5B1"
              accessibilityLabel={`Medicine ${i + 1} dosage`}
            />
            <TextInput
              style={styles.input}
              value={med.frequency}
              onChangeText={(v) => updateMed(i, { frequency: v })}
              placeholder="Frequency (e.g. Twice daily)"
              placeholderTextColor="#9AA5B1"
              accessibilityLabel={`Medicine ${i + 1} frequency`}
            />
            <TextInput
              style={styles.input}
              value={med.duration}
              onChangeText={(v) => updateMed(i, { duration: v })}
              placeholder="Duration (e.g. 7 days)"
              placeholderTextColor="#9AA5B1"
              accessibilityLabel={`Medicine ${i + 1} duration`}
            />
          </View>
        ))}

        <Pressable style={styles.addButton} onPress={addMed} accessibilityRole="button">
          <Ionicons name="add" size={18} color={colors.brand.DEFAULT} />
          <Text style={styles.addButtonText}>Add another medicine</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Advice, follow-up instructions, etc."
            placeholderTextColor="#9AA5B1"
            accessibilityLabel="Notes (optional)"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.saveButton} onPress={submit} disabled={isSaving} accessibilityRole="button">
          {isSaving ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.saveButtonText}>Issue prescription</Text>}
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  error: { color: "#c62828", fontFamily: fonts.regular },
  hint: { color: "#666", fontFamily: fonts.regular, textAlign: "center" },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10, ...cardShadow },
  patient: { fontFamily: fonts.semibold, fontSize: 16, color: colors.neutral.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: "#666" },

  medHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  medTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.neutral.foreground },
  label: { fontFamily: fonts.medium, fontSize: 13, color: "#666" },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },

  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  addButtonText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.brand.DEFAULT },

  saveButton: { backgroundColor: colors.brand.DEFAULT, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  saveButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
});
