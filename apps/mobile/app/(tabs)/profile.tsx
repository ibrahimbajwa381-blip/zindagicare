import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import {
  getPatientProfile,
  updatePatientProfile,
  type PatientProfileDto,
  type BloodGroup,
} from "@/api/patient-profile";
import { ApiRequestError } from "@/api/client";
import { Spinner } from "@/components/ui/spinner";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { interpolate, type Locale } from "@zindagi/i18n";

type IconName = keyof typeof Ionicons.glyphMap;

function parseList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatList(list: string[] | undefined): string {
  return (list ?? []).join(", ");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
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
  const { signOut, deleteAccount } = useAuth();
  const { locale, t, setLocale } = useLocale();
  const [isDeleting, setIsDeleting] = useState(false);
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
      setError(e instanceof ApiRequestError ? e.message : t.profile.loadError);
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
      const message = e instanceof ApiRequestError ? e.message : t.profile.saveError;
      setError(message);
      Alert.alert(t.profile.saveErrorTitle, message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      t.profile.deleteConfirmTitle,
      t.profile.deleteConfirmMessage,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.profile.deleteConfirmButton,
          style: "destructive",
          onPress: () => {
            Alert.alert(t.profile.deleteConfirmAgainTitle, t.profile.deleteConfirmAgainMessage, [
              { text: t.common.cancel, style: "cancel" },
              {
                text: t.profile.deleteFinalButton,
                style: "destructive",
                onPress: async () => {
                  setIsDeleting(true);
                  try {
                    await deleteAccount();
                  } catch (e) {
                    Alert.alert(t.profile.deleteErrorTitle, e instanceof ApiRequestError ? e.message : t.common.tryAgain);
                  } finally {
                    setIsDeleting(false);
                  }
                },
              },
            ]);
          },
        },
      ],
    );
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(profile.user.name)}</Text>
        </View>
        <Text style={styles.name}>{profile.user.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.85)" />
          <Text style={styles.meta}>{profile.user.city}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.meta}>
            {interpolate(t.profile.memberSince, { date: new Date(profile.user.memberSince).toLocaleDateString() })}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#c62828" />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <Section title={t.settings.language} icon="language-outline">
          <View style={styles.languageRow}>
            <LanguageOption label={t.common.english} active={locale === "en"} onPress={() => setLocale("en" as Locale)} />
            <LanguageOption label={t.common.urdu} active={locale === "ur"} onPress={() => setLocale("ur" as Locale)} />
          </View>
        </Section>

        <Section title={t.profile.sections.account} icon="person-outline">
          <Field label={t.profile.fields.name} value={form.name} editable={editing} onChange={(v) => setForm({ ...form, name: v })} notSetLabel={t.profile.notSet} />
          <Field
            label={t.profile.fields.email}
            value={form.email}
            editable={editing}
            keyboardType="email-address"
            onChange={(v) => setForm({ ...form, email: v })}
            notSetLabel={t.profile.notSet}
          />
          <Field
            label={t.profile.fields.phone}
            value={form.phone}
            editable={editing}
            keyboardType="phone-pad"
            onChange={(v) => setForm({ ...form, phone: v })}
            notSetLabel={t.profile.notSet}
          />
          <Field label={t.profile.fields.city} value={form.city} editable={editing} onChange={(v) => setForm({ ...form, city: v })} notSetLabel={t.profile.notSet} last />
        </Section>

        <Section title={t.profile.sections.health} icon="fitness-outline">
          <Field
            label={t.profile.fields.dateOfBirth}
            placeholder="YYYY-MM-DD"
            value={form.dateOfBirth}
            editable={editing}
            onChange={(v) => setForm({ ...form, dateOfBirth: v })}
            notSetLabel={t.profile.notSet}
          />
          <Field label={t.profile.fields.gender} value={form.gender} editable={editing} onChange={(v) => setForm({ ...form, gender: v })} notSetLabel={t.profile.notSet} />
          <Field
            label={t.profile.fields.bloodGroup}
            value={form.bloodGroup}
            editable={editing}
            onChange={(v) => setForm({ ...form, bloodGroup: v })}
            notSetLabel={t.profile.notSet}
          />
          <Field
            label={t.profile.fields.allergies}
            placeholder={t.profile.commaSeparated}
            value={form.allergies}
            editable={editing}
            onChange={(v) => setForm({ ...form, allergies: v })}
            notSetLabel={t.profile.notSet}
          />
          <Field
            label={t.profile.fields.chronicConditions}
            placeholder={t.profile.commaSeparated}
            value={form.chronicConditions}
            editable={editing}
            onChange={(v) => setForm({ ...form, chronicConditions: v })}
            notSetLabel={t.profile.notSet}
            last
          />
        </Section>

        <Section title={t.profile.sections.emergencyContact} icon="call-outline">
          <Field
            label={t.profile.fields.name}
            accessibilityLabel={`${t.profile.sections.emergencyContact} ${t.profile.fields.name}`}
            value={form.emergencyName}
            editable={editing}
            onChange={(v) => setForm({ ...form, emergencyName: v })}
            notSetLabel={t.profile.notSet}
          />
          <Field
            label={t.profile.fields.phone}
            accessibilityLabel={`${t.profile.sections.emergencyContact} ${t.profile.fields.phone}`}
            value={form.emergencyPhone}
            editable={editing}
            keyboardType="phone-pad"
            onChange={(v) => setForm({ ...form, emergencyPhone: v })}
            notSetLabel={t.profile.notSet}
          />
          <Field
            label={t.profile.fields.relation}
            value={form.emergencyRelation}
            editable={editing}
            onChange={(v) => setForm({ ...form, emergencyRelation: v })}
            notSetLabel={t.profile.notSet}
            last
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
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>{t.profile.cancel}</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={save} disabled={isSaving} accessibilityRole="button">
                {isSaving ? (
                  <Spinner size="sm" color={colors.brand.foreground} />
                ) : (
                  <Text style={styles.buttonText}>{t.profile.saveChanges}</Text>
                )}
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.button} onPress={() => setEditing(true)} accessibilityRole="button">
              <Ionicons name="create-outline" size={18} color={colors.brand.foreground} />
              <Text style={styles.buttonText}>{t.profile.editProfile}</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={18} color="#e53935" />
          <Text style={styles.signOutText}>{t.profile.signOut}</Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL("https://zindagicare.com/privacy")} accessibilityRole="link">
            <Text style={styles.legalLink}>{t.profile.privacyPolicy}</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => Linking.openURL("https://zindagicare.com/terms")} accessibilityRole="link">
            <Text style={styles.legalLink}>{t.profile.termsOfService}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.deleteAccountButton} onPress={confirmDeleteAccount} disabled={isDeleting} accessibilityRole="button">
          {isDeleting ? (
            <Spinner size="sm" color="#e53935" />
          ) : (
            <Text style={styles.deleteAccountText}>{t.profile.deleteAccount}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function LanguageOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.languageChip, active && styles.languageChipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={15} color={colors.brand.DEFAULT} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Field({
  label,
  accessibilityLabel,
  value,
  editable,
  onChange,
  keyboardType,
  placeholder,
  notSetLabel,
  last,
}: {
  label: string;
  accessibilityLabel?: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  placeholder?: string;
  notSetLabel: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.field, !last && styles.fieldDivider]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editable ? (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#b6bcc6"
          autoCapitalize="none"
          accessibilityLabel={accessibilityLabel ?? label}
        />
      ) : (
        <Text style={[styles.fieldValue, !value && styles.fieldValueEmpty]}>{value || notSetLabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  container: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },

  hero: {
    backgroundColor: colors.brand.DEFAULT,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontFamily: fonts.bold, color: colors.brand.foreground },
  name: { fontSize: 20, fontFamily: fonts.bold, color: colors.brand.foreground },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  meta: { color: "rgba(255,255,255,0.85)", fontFamily: fonts.medium, fontSize: 12.5 },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginHorizontal: 4,
  },

  body: { padding: 20, gap: 20, marginTop: -12 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fdecea",
    borderRadius: 12,
    padding: 12,
  },
  error: { color: "#c62828", fontFamily: fonts.medium, fontSize: 13 },

  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.brand.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.neutral.foreground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.neutral.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    ...cardShadow,
  },

  languageRow: { flexDirection: "row", gap: 10, backgroundColor: colors.neutral.background, borderRadius: 16, padding: 12, ...cardShadow },
  languageChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.neutral.muted,
  },
  languageChipActive: { backgroundColor: colors.brand.DEFAULT },
  languageChipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.neutral.foreground },
  languageChipTextActive: { color: colors.brand.foreground },

  field: { paddingVertical: 12, gap: 4 },
  fieldDivider: { borderBottomWidth: 1, borderBottomColor: colors.neutral.border },
  fieldLabel: { fontSize: 12, color: "#8a93a3", fontFamily: fonts.medium },
  fieldValue: { fontSize: 15.5, fontFamily: fonts.medium, color: colors.neutral.foreground },
  fieldValueEmpty: { color: "#b6bcc6", fontFamily: fonts.regular },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.muted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },

  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
  button: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.25,
  },
  buttonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
  secondaryButton: { backgroundColor: colors.neutral.muted, shadowOpacity: 0, elevation: 0 },
  secondaryButtonText: { color: colors.neutral.foreground, fontFamily: fonts.semibold, fontSize: 15 },

  signOutButton: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  signOutText: { color: "#e53935", fontFamily: fonts.semibold, fontSize: 15 },

  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 8 },
  legalLink: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.brand.DEFAULT },
  legalDot: { color: "#ccc" },

  deleteAccountButton: { alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  deleteAccountText: { color: "#999", fontFamily: fonts.medium, fontSize: 13, textDecorationLine: "underline" },
});
