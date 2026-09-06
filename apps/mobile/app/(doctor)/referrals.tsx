import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, FlatList, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getDoctorReferral, regenerateDoctorReferralCode, type DoctorReferralSummary } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" });
}

export default function DoctorReferralsScreen() {
  const [referral, setReferral] = useState<{ code: string; url: string } | null>(null);
  const [summary, setSummary] = useState<DoctorReferralSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getDoctorReferral();
      setReferral(res.referral);
      setSummary(res.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load referral info");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shareLink = async () => {
    if (!referral) return;
    try {
      await Share.share({ message: referral.url });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const regenerate = () => {
    Alert.alert(
      "Regenerate referral code?",
      "Your old referral link will stop working for new signups.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: async () => {
            setIsRegenerating(true);
            try {
              const res = await regenerateDoctorReferralCode();
              setReferral(res.referral);
            } catch (e) {
              Alert.alert("Couldn't regenerate", e instanceof ApiRequestError ? e.message : "Please try again");
            } finally {
              setIsRegenerating(false);
            }
          },
        },
      ],
    );
  };

  if (!referral || !summary) {
    return error ? (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    ) : (
      <BrandLoadingScreen />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Your referral code</Text>
        <Text style={styles.code}>{referral.code}</Text>
        <Text style={styles.link} numberOfLines={1}>
          {referral.url}
        </Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={shareLink} accessibilityRole="button">
            <Ionicons name="share-social-outline" size={16} color={colors.brand.foreground} />
            <Text style={styles.actionButtonText}>Share link</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={regenerate}
            disabled={isRegenerating}
            accessibilityRole="button"
          >
            {isRegenerating ? (
              <Spinner size="sm" />
            ) : (
              <>
                <Ionicons name="refresh" size={16} color={colors.neutral.foreground} />
                <Text style={styles.secondaryButtonText}>Regenerate</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.statGrid}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary.referredPatientCount}</Text>
          <Text style={styles.statLabel}>Referred patients</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>Rs. {summary.lifetimeBonusEarnings.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total earned from referrals</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Referred patients</Text>
        {summary.referredPatients.length === 0 ? (
          <Text style={styles.hint}>No patients referred yet. Share your link to start earning bonus commission.</Text>
        ) : (
          <FlatList
            data={summary.referredPatients}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSub}>Joined {formatDate(item.joinedAt)}</Text>
              </View>
            )}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#c62828", fontFamily: fonts.regular },
  hint: { color: "#666", fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },

  codeCard: { backgroundColor: "#fff", borderRadius: 18, padding: 20, gap: 6, ...cardShadow },
  codeLabel: { fontFamily: fonts.medium, fontSize: 12, color: "#888", textTransform: "uppercase" },
  code: { fontFamily: fonts.bold, fontSize: 24, color: colors.brand.mutedForeground, letterSpacing: 1 },
  link: { fontFamily: fonts.regular, fontSize: 12.5, color: "#666" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 13.5 },
  secondaryButton: { backgroundColor: colors.neutral.muted },
  secondaryButtonText: { color: colors.neutral.foreground, fontFamily: fonts.semibold, fontSize: 13.5 },

  statGrid: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14, gap: 4, ...cardShadow },
  statValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.neutral.foreground },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },

  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 8, ...cardShadow },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.neutral.border, gap: 2 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.neutral.foreground },
  rowSub: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },
});
