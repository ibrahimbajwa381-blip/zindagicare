import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getDoctorProfile, type DoctorProfileDto } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth-context";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/config";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const VERIFICATION_LABELS: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  restricted: "Restricted",
};

const VERIFICATION_COLORS: Record<string, string> = {
  pending: "#F5A623",
  approved: "#16a34a",
  rejected: "#c62828",
  restricted: "#c62828",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DoctorProfileScreen() {
  const router = useRouter();
  const { signOut, deleteAccount } = useAuth();
  const [profile, setProfile] = useState<DoctorProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const dto = await getDoctorProfile();
      setProfile(dto);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load profile");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently deactivates your ZindagiCare doctor account and signs you out. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            Alert.alert("Are you sure?", "Confirm to permanently delete your account.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Yes, delete my account",
                style: "destructive",
                onPress: async () => {
                  setIsDeleting(true);
                  try {
                    await deleteAccount();
                  } catch (e) {
                    Alert.alert("Couldn't delete account", e instanceof ApiRequestError ? e.message : "Please try again");
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

  if (!profile) {
    return error ? (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    ) : (
      <BrandLoadingScreen />
    );
  }

  const avatarUri = resolveMediaUrl(profile.user.avatarUrl);
  const credentials = [profile.medicalDegree, ...profile.qualifications].filter(Boolean) as string[];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{initials(profile.user.name)}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{profile.user.name}</Text>
            {profile.specialties.length > 0 ? (
              <Text style={styles.specialty}>{profile.specialties.join(" · ")}</Text>
            ) : null}
            <View style={[styles.statusPill, { backgroundColor: `${VERIFICATION_COLORS[profile.verificationStatus] ?? "#888"}1A` }]}>
              <Text style={[styles.statusText, { color: VERIFICATION_COLORS[profile.verificationStatus] ?? "#888" }]}>
                {VERIFICATION_LABELS[profile.verificationStatus] ?? profile.verificationStatus}
              </Text>
            </View>
          </View>
        </View>

        <Pressable style={styles.editButton} onPress={() => router.push("/(doctor)/profile-edit")} accessibilityRole="button">
          <Ionicons name="create-outline" size={17} color={colors.brand.foreground} />
          <Text style={styles.editButtonText}>Edit profile</Text>
        </Pressable>
      </View>

      <Section title="Contact" icon="call-outline">
        <Field label="Email" value={profile.user.email} />
        <Field label="Phone" value={profile.user.phone} />
      </Section>

      <Section title="Practice" icon="medkit-outline">
        <Field label="Consultation fee" value={`Rs. ${profile.consultationFee.toLocaleString()}`} />
        <Field label="Experience" value={profile.experienceYears ? `${profile.experienceYears}+ years` : undefined} />
        <Field label="Languages" value={profile.languages.join(", ")} />
        {credentials.length > 0 ? <Field label="Qualifications" value={credentials.join(", ")} /> : null}
        {profile.medicalCollege ? (
          <Field
            label="Medical college"
            value={`${profile.medicalCollege}${profile.graduationYear ? ` · ${profile.graduationYear}` : ""}`}
          />
        ) : null}
      </Section>

      {profile.bio ? (
        <Section title="Bio" icon="document-text-outline">
          <Text style={styles.bodyText}>{profile.bio}</Text>
        </Section>
      ) : null}

      {profile.hospitals.length > 0 ? (
        <Section title="Practice locations" icon="location-outline">
          {profile.hospitals.map((h) => (
            <View key={`${h.name}-${h.city}`} style={styles.hospitalCard}>
              <Text style={styles.hospitalName}>{h.name}</Text>
              <Text style={styles.hospitalSub}>
                {h.city}
                {h.address ? ` · ${h.address}` : ""}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}

      {profile.weeklyAvailability.length > 0 ? (
        <Section title="Weekly availability" icon="calendar-outline">
          {profile.weeklyAvailability
            .slice()
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((w, i) => (
              <Text key={i} style={styles.listItem}>
                {DAY_LABELS[w.dayOfWeek] ?? w.dayOfWeek} · {w.startTimeLocal}–{w.endTimeLocal}
              </Text>
            ))}
        </Section>
      ) : null}

      <Section title="Sunday free consult" icon="heart-outline">
        <Text style={styles.bodyText}>
          {profile.sundayConsult.enabled
            ? `Enabled · ${profile.sundayConsult.startTimeLocal}–${profile.sundayConsult.endTimeLocal}`
            : "Not enabled"}
        </Text>
      </Section>

      <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
        <Ionicons name="log-out-outline" size={18} color="#e53935" />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <View style={styles.legalRow}>
        <Pressable onPress={() => Linking.openURL("https://zindagicare.com/privacy")} accessibilityRole="link">
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => Linking.openURL("https://zindagicare.com/terms")} accessibilityRole="link">
          <Text style={styles.legalLink}>Terms of Service</Text>
        </Pressable>
      </View>

      <Pressable style={styles.deleteAccountButton} onPress={confirmDeleteAccount} disabled={isDeleting} accessibilityRole="button">
        {isDeleting ? <Spinner size="sm" color="#e53935" /> : <Text style={styles.deleteAccountText}>Delete account</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={colors.brand.DEFAULT} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#c62828", fontFamily: fonts.regular },

  headerCard: { backgroundColor: "#fff", borderRadius: 18, padding: 18, gap: 14, ...cardShadow },
  headerTop: { flexDirection: "row", gap: 14 },
  avatar: { width: 76, height: 76, borderRadius: 20, backgroundColor: colors.neutral.muted },
  avatarPlaceholder: { backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.bold, color: colors.brand.mutedForeground, fontSize: 26 },
  headerInfo: { flex: 1, gap: 4, justifyContent: "center" },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.neutral.foreground },
  specialty: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent.DEFAULT },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 4 },
  statusText: { fontFamily: fonts.semibold, fontSize: 11 },
  editButton: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 12,
    borderRadius: 12,
  },
  editButtonText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.brand.foreground },

  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10, ...cardShadow },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  bodyText: { fontFamily: fonts.regular, fontSize: 13, color: "#555", lineHeight: 20 },
  listItem: { fontFamily: fonts.regular, fontSize: 13, color: "#555", lineHeight: 20 },

  field: { gap: 2 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 11, color: "#999", textTransform: "uppercase" },
  fieldValue: { fontFamily: fonts.regular, fontSize: 14, color: colors.neutral.foreground },

  hospitalCard: { backgroundColor: colors.neutral.muted, borderRadius: 12, padding: 12, gap: 2 },
  hospitalName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.neutral.foreground },
  hospitalSub: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },

  signOutButton: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  signOutText: { color: "#e53935", fontFamily: fonts.semibold, fontSize: 15 },

  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  legalLink: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.brand.DEFAULT },
  legalDot: { color: "#ccc" },

  deleteAccountButton: { alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  deleteAccountText: { color: "#999", fontFamily: fonts.medium, fontSize: 13, textDecorationLine: "underline" },
});
