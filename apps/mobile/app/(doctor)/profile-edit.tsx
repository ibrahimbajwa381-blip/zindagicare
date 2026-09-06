import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import { getDoctorProfile, updateDoctorProfile, type DoctorProfileDto } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";

function parseList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type FormState = {
  bio: string;
  consultationFee: string;
  languages: string;
  sundayEnabled: boolean;
  sundayStart: string;
  sundayEnd: string;
};

function toForm(dto: DoctorProfileDto): FormState {
  return {
    bio: dto.bio ?? "",
    consultationFee: String(dto.consultationFee ?? ""),
    languages: dto.languages.join(", "),
    sundayEnabled: dto.sundayConsult.enabled,
    sundayStart: dto.sundayConsult.startTimeLocal ?? "10:00",
    sundayEnd: dto.sundayConsult.endTimeLocal ?? "13:00",
  };
}

export default function DoctorProfileEditScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<DoctorProfileDto | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDoctorProfile()
      .then((dto) => {
        setProfile(dto);
        setForm(toForm(dto));
      })
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "Failed to load profile"));
  }, []);

  const save = async () => {
    if (!form) return;
    const fee = Number(form.consultationFee);
    if (!Number.isFinite(fee) || fee < 500) {
      Alert.alert("Invalid fee", "Consultation fee must be at least Rs. 500.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await updateDoctorProfile({
        bio: form.bio || null,
        consultationFee: fee,
        languages: parseList(form.languages),
        sundayConsult: {
          enabled: form.sundayEnabled,
          startTimeLocal: form.sundayEnabled ? form.sundayStart : undefined,
          endTimeLocal: form.sundayEnabled ? form.sundayEnd : undefined,
        },
      });
      router.back();
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : "Failed to save changes";
      setError(message);
      Alert.alert("Couldn't save changes", message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile || !form) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit profile" }} />
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
      <Stack.Screen options={{ title: "Edit profile" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Specialties, practice locations, and weekly availability can currently only be edited on the website.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.bio}
            onChangeText={(v) => setForm({ ...form, bio: v })}
            multiline
            placeholder="Tell patients about your experience and approach to care"
            placeholderTextColor="#9AA5B1"
            accessibilityLabel="Bio"
          />

          <Text style={styles.label}>Consultation fee (PKR)</Text>
          <TextInput
            style={styles.input}
            value={form.consultationFee}
            onChangeText={(v) => setForm({ ...form, consultationFee: v.replace(/[^0-9]/g, "") })}
            keyboardType="number-pad"
            placeholder="e.g. 1500"
            placeholderTextColor="#9AA5B1"
            accessibilityLabel="Consultation fee (PKR)"
          />

          <Text style={styles.label}>Languages</Text>
          <TextInput
            style={styles.input}
            value={form.languages}
            onChangeText={(v) => setForm({ ...form, languages: v })}
            placeholder="Comma separated, e.g. English, Urdu"
            placeholderTextColor="#9AA5B1"
            accessibilityLabel="Languages"
          />
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sunday free consult</Text>
              <Text style={styles.subLabel}>Offer free consultations on Sundays</Text>
            </View>
            <Switch
              value={form.sundayEnabled}
              onValueChange={(v) => setForm({ ...form, sundayEnabled: v })}
              trackColor={{ true: colors.brand.DEFAULT }}
            />
          </View>
          {form.sundayEnabled ? (
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Start (HH:mm)</Text>
                <TextInput
                  style={styles.input}
                  value={form.sundayStart}
                  onChangeText={(v) => setForm({ ...form, sundayStart: v })}
                  placeholder="10:00"
                  placeholderTextColor="#9AA5B1"
                  accessibilityLabel="Start (HH:mm)"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End (HH:mm)</Text>
                <TextInput
                  style={styles.input}
                  value={form.sundayEnd}
                  onChangeText={(v) => setForm({ ...form, sundayEnd: v })}
                  placeholder="13:00"
                  placeholderTextColor="#9AA5B1"
                  accessibilityLabel="End (HH:mm)"
                />
              </View>
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.saveButton} onPress={save} disabled={isSaving} accessibilityRole="button">
          {isSaving ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.saveButtonText}>Save changes</Text>}
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#c62828", fontFamily: fonts.regular },
  hint: { fontFamily: fonts.regular, fontSize: 12.5, color: "#888", lineHeight: 18 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10, ...cardShadow },
  label: { fontFamily: fonts.medium, fontSize: 13, color: "#666" },
  subLabel: { fontFamily: fonts.regular, fontSize: 12, color: "#999", marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeRow: { flexDirection: "row", gap: 12 },

  saveButton: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
});
