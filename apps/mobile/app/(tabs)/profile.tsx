import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/lib/auth-context";
import {
  getPatientProfile,
  updatePatientProfile,
  type PatientProfileDto,
  type BloodGroup,
} from "@/api/patient-profile";
import { ApiRequestError } from "@/api/client";
import { Spinner } from "@/components/ui/spinner";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts } from "@/lib/theme";

function parseList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatList(list: string[] | undefined): string {
  return (list ?? []).join(", ");
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  city: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  allergies: string;
  chronicConditions: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
};

function toForm(dto: PatientProfileDto): FormState {
  return {
    name: dto.user.name ?? "",
    email: dto.user.email ?? "",
    phone: dto.user.phone ?? "",
    city: dto.user.city ?? "",
    dateOfBirth: dto.profile.dateOfBirth ?? "",
    gender: dto.profile.gender ?? "",
    bloodGroup: dto.profile.bloodGroup ?? "",
    allergies: formatList(dto.profile.allergies),
    chronicConditions: formatList(dto.profile.chronicConditions),
    emergencyName: dto.profile.emergencyContact?.name ?? "",
    emergencyPhone: dto.profile.emergencyContact?.phone ?? "",
    emergencyRelation: dto.profile.emergencyContact?.relation ?? "",
  };
}

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<PatientProfileDto | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dto = await getPatientProfile();
      setProfile(dto);
      setForm(toForm(dto));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updatePatientProfile({
        name: form.name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        city: form.city || undefined,
        dateOfBirth: form.dateOfBirth || null,
        gender: (form.gender as "male" | "female" | "other") || null,
        bloodGroup: (form.bloodGroup as BloodGroup) || null,
        allergies: parseList(form.allergies),
        chronicConditions: parseList(form.chronicConditions),
        emergencyContact: {
          name: form.emergencyName || undefined,
          phone: form.emergencyPhone || undefined,
          relation: form.emergencyRelation || undefined,
        },
      });
      setProfile(updated);
      setForm(toForm(updated));
      setEditing(false);
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : "Failed to save profile";
      setError(message);
      Alert.alert("Couldn't save changes", message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profile || !form) {
    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
      );
    }
    return <BrandLoadingScreen />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{profile.user.name}</Text>
        <Text style={styles.meta}>
          {profile.user.city} · Member since{" "}
          {new Date(profile.user.memberSince).toLocaleDateString()}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Section title="Account">
        <Field label="Name" value={form.name} editable={editing} onChange={(v) => setForm({ ...form, name: v })} />
        <Field
          label="Email"
          value={form.email}
          editable={editing}
          keyboardType="email-address"
          onChange={(v) => setForm({ ...form, email: v })}
        />
        <Field
          label="Phone"
          value={form.phone}
          editable={editing}
          keyboardType="phone-pad"
          onChange={(v) => setForm({ ...form, phone: v })}
        />
        <Field label="City" value={form.city} editable={editing} onChange={(v) => setForm({ ...form, city: v })} />
      </Section>

      <Section title="Health">
        <Field
          label="Date of birth (YYYY-MM-DD)"
          value={form.dateOfBirth}
          editable={editing}
          onChange={(v) => setForm({ ...form, dateOfBirth: v })}
        />
        <Field label="Gender" value={form.gender} editable={editing} onChange={(v) => setForm({ ...form, gender: v })} />
        <Field
          label="Blood group"
          value={form.bloodGroup}
          editable={editing}
          onChange={(v) => setForm({ ...form, bloodGroup: v })}
        />
        <Field
          label="Allergies (comma separated)"
          value={form.allergies}
          editable={editing}
          onChange={(v) => setForm({ ...form, allergies: v })}
        />
        <Field
          label="Chronic conditions (comma separated)"
          value={form.chronicConditions}
          editable={editing}
          onChange={(v) => setForm({ ...form, chronicConditions: v })}
        />
      </Section>

      <Section title="Emergency contact">
        <Field
          label="Name"
          value={form.emergencyName}
          editable={editing}
          onChange={(v) => setForm({ ...form, emergencyName: v })}
        />
        <Field
          label="Phone"
          value={form.emergencyPhone}
          editable={editing}
          onChange={(v) => setForm({ ...form, emergencyPhone: v })}
        />
        <Field
          label="Relation"
          value={form.emergencyRelation}
          editable={editing}
          onChange={(v) => setForm({ ...form, emergencyRelation: v })}
        />
      </Section>

      <View style={styles.actions}>
        {editing ? (
          <>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                setForm(toForm(profile));
                setEditing(false);
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={save} disabled={isSaving}>
              {isSaving ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.buttonText}>Save</Text>}
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.button} onPress={() => setEditing(true)}>
            <Text style={styles.buttonText}>Edit profile</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  editable,
  onChange,
  keyboardType,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editable ? (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
      ) : (
        <Text style={styles.fieldValue}>{value || "—"}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  header: { gap: 4, marginBottom: 8 },
  name: { fontSize: 22, fontFamily: fonts.bold, color: colors.neutral.foreground },
  meta: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.medium },
  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontFamily: fonts.bold, color: "#888", textTransform: "uppercase" },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, color: "#888", fontFamily: fonts.regular },
  fieldValue: { fontSize: 16, fontFamily: fonts.regular },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  button: {
    flex: 1,
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: colors.brand.foreground, fontFamily: fonts.semibold },
  secondaryButton: { backgroundColor: colors.neutral.muted },
  secondaryButtonText: { color: colors.neutral.foreground, fontFamily: fonts.semibold },
  signOutButton: { alignItems: "center", paddingVertical: 16 },
  signOutText: { color: "#e53935", fontFamily: fonts.semibold },
});
