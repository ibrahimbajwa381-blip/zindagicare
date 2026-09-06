import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { getDoctorProfile, getDoctorSummary, type DoctorDashboardSummary, type DoctorProfileDto } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function Stat({ icon, label, value, tint }: { icon: IconName; label: string; value: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, tint ? { backgroundColor: `${tint}1A` } : null]}>
        <Ionicons name={icon} size={17} color={tint ?? colors.brand.DEFAULT} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const VERIFICATION_COPY: Record<string, { title: string; body: string; tone: "warn" | "danger" }> = {
  pending: {
    title: "Verification pending",
    body: "Your documents are under review. You'll be listed and able to accept consults once approved.",
    tone: "warn",
  },
  rejected: {
    title: "Verification rejected",
    body: "Update your documents on the website to resubmit for verification.",
    tone: "danger",
  },
  restricted: {
    title: "Account restricted",
    body: "Your account was restricted. Contact support or check the web dashboard for details.",
    tone: "danger",
  },
};

export default function DoctorDashboardScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<DoctorDashboardSummary | null>(null);
  const [profile, setProfile] = useState<DoctorProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryRes, profileRes] = await Promise.all([getDoctorSummary(), getDoctorProfile()]);
      setSummary(summaryRes);
      setProfile(profileRes);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load dashboard");
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

  if (!summary || !profile) {
    return (
      <>
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

  const verificationBanner = VERIFICATION_COPY[profile.verificationStatus];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Hi, {profile.user.name.split(" ")[0]}</Text>

      {verificationBanner ? (
        <View
          style={[
            styles.banner,
            verificationBanner.tone === "danger" ? styles.bannerDanger : styles.bannerWarn,
          ]}
        >
          <Ionicons
            name="alert-circle"
            size={18}
            color={verificationBanner.tone === "danger" ? "#c62828" : "#946200"}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{verificationBanner.title}</Text>
            <Text style={styles.bannerBody}>{verificationBanner.body}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.statGrid}>
        <Stat icon="people" label="Total patients" value={String(summary.patients)} />
        <Stat icon="hourglass" label="Pending requests" value={String(summary.pendingRequests)} tint="#F5A623" />
        <Stat icon="today" label="Today's appointments" value={String(summary.todayAppointments)} />
        <Stat icon="calendar" label="This week" value={String(summary.upcomingThisWeek)} />
        <Stat icon="star" label="Rating" value={`${summary.ratingAvg.toFixed(1)} (${summary.ratingCount})`} tint="#F5A623" />
        <Stat icon="checkmark-done" label="Completion rate" value={`${summary.completionRate}%`} tint="#16a34a" />
        <Stat icon="wallet" label="Earnings this month" value={`Rs. ${summary.earningsThisMonth.toLocaleString()}`} tint={colors.accent.DEFAULT} />
        <Stat icon="cash" label="Available balance" value={`Rs. ${summary.availableBalance.toLocaleString()}`} tint={colors.accent.DEFAULT} />
        <Stat icon="document-text" label="Prescriptions written" value={String(summary.prescriptionsWritten)} />
        <Stat icon="repeat" label="Returning patients" value={String(summary.returningPatients)} />
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionGrid}>
          <QuickAction icon="calendar" label="Consult requests" onPress={() => router.push("/(doctor)/requests")} />
          <QuickAction icon="people" label="Patients" onPress={() => router.push("/(doctor)/patients")} />
          <QuickAction icon="wallet" label="Earnings" onPress={() => router.push("/(doctor)/earnings")} />
          <QuickAction icon="document-text" label="Prescriptions" onPress={() => router.push("/(doctor)/prescriptions")} />
          <QuickAction icon="gift" label="Referrals" onPress={() => router.push("/(doctor)/referrals")} />
          <QuickAction icon="shield-checkmark" label="Verification" onPress={() => router.push("/(doctor)/verification")} />
          <QuickAction icon="pulse" label="Urgent calls" onPress={() => router.push("/(doctor)/urgent-calls")} />
          <QuickAction icon="heart" label="Sunday consult" onPress={() => router.push("/(doctor)/sunday-consult")} />
          <QuickAction icon="home" label="Home visits" onPress={() => router.push("/(doctor)/home-visits")} />
          <QuickAction icon="chatbubbles" label="Messages" onPress={() => router.push("/(doctor)/messages")} />
          <QuickAction icon="person" label="My profile" onPress={() => router.push("/(doctor)/profile")} />
        </View>
        <Text style={styles.comingSoonHint}>
          Joining a video consult still opens on the website — native in-app calling is coming later.
        </Text>
      </View>
    </ScrollView>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.brand.mutedForeground} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#c62828", fontFamily: fonts.regular },
  greeting: { fontFamily: fonts.bold, fontSize: 22, color: colors.neutral.foreground },

  banner: { flexDirection: "row", gap: 10, borderRadius: 14, padding: 14 },
  bannerWarn: { backgroundColor: "#FFF6E0" },
  bannerDanger: { backgroundColor: "#fdecea" },
  bannerTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.neutral.foreground },
  bannerBody: { fontFamily: fonts.regular, fontSize: 12.5, color: "#555", marginTop: 2, lineHeight: 18 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "47.5%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 6,
    ...cardShadow,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.brand.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.neutral.foreground },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },

  quickActions: { gap: 10 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard: {
    width: "31%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    ...cardShadow,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brand.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.neutral.foreground, textAlign: "center" },
  comingSoonHint: { fontFamily: fonts.regular, fontSize: 12, color: "#999", lineHeight: 18 },
});
