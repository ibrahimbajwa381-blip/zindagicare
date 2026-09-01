import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/lib/auth-context";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/config";
import { formatKarachi } from "@/lib/format-date";
import { getOnlineBooking, type OnlineBooking } from "@/api/dashboard";
import { listMyHomeVisits, type HomeVisitDto } from "@/api/home-visits";
import { listPrescriptions, type PrescriptionSummary } from "@/api/prescriptions";
import { joinVideoSession } from "@/api/appointments";
import { ApiRequestError } from "@/api/client";

type IconName = keyof typeof Ionicons.glyphMap;

const QUICK_ACTIONS: {
  icon: IconName;
  label: string;
  href: "/(tabs)/doctors" | "/home-visit" | "/prescription" | "/(tabs)/appointments" | "/refund-request";
}[] = [
  { icon: "medkit-outline", label: "Book\nconsult", href: "/(tabs)/doctors" },
  { icon: "home-outline", label: "Home\nvisit", href: "/home-visit" },
  { icon: "document-text-outline", label: "Prescrip-\ntions", href: "/prescription" },
  { icon: "calendar-outline", label: "Appoint-\nments", href: "/(tabs)/appointments" },
  { icon: "cash-outline", label: "Request\nrefund", href: "/refund-request" },
];

const ONLINE_STATUS_LABEL: Record<string, string> = {
  pending: "Payment pending",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
};

const VISIT_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  assigned: "Assigned",
  en_route: "On the way",
  arrived: "Arrived",
};

const ACTIVE_VISIT_STATUSES = new Set(["requested", "assigned", "en_route", "arrived"]);

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [booking, setBooking] = useState<OnlineBooking | null>(null);
  const [hasBookingError, setHasBookingError] = useState(false);
  const [nextVisit, setNextVisit] = useState<HomeVisitDto | null>(null);
  const [recentRx, setRecentRx] = useState<PrescriptionSummary[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const load = useCallback(async () => {
    const [bookingResult, visitsResult, rxResult] = await Promise.allSettled([
      getOnlineBooking(),
      listMyHomeVisits(),
      listPrescriptions(),
    ]);

    if (bookingResult.status === "fulfilled") {
      setBooking(bookingResult.value);
      setHasBookingError(false);
    } else {
      setHasBookingError(true);
    }

    if (visitsResult.status === "fulfilled") {
      const upcoming = visitsResult.value
        .filter((v) => ACTIVE_VISIT_STATUSES.has(v.status))
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      setNextVisit(upcoming[0] ?? null);
    }

    if (rxResult.status === "fulfilled") {
      setRecentRx(rxResult.value.slice(0, 2));
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

  const onJoin = async () => {
    if (!booking) return;
    setIsJoining(true);
    try {
      const payload = await joinVideoSession(booking.appointmentId);
      await Linking.openURL(payload.joinUrl);
    } catch (e) {
      Alert.alert("Can't join yet", e instanceof ApiRequestError ? e.message : "Please try again closer to your appointment time.");
    } finally {
      setIsJoining(false);
    }
  };

  const avatarUri = resolveMediaUrl(booking?.doctor.avatarUrl);
  const canJoin = booking?.status === "confirmed" || booking?.status === "in_progress";
  const firstName = user?.name ? user.name.split(" ")[0] : "";
  const greeting = greetingForHour(new Date().getHours());
  const hasActivity = Boolean(booking) || Boolean(nextVisit);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.brand.DEFAULT} />}
    >
      <LinearGradient
        colors={[colors.accent.DEFAULT, colors.brand.dark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>{greeting}</Text>
            <Text style={styles.heroGreeting}>{firstName || "there"}</Text>
          </View>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarInitial}>{(firstName[0] ?? "Z").toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.heroHint}>
          {hasActivity ? "Here's what's happening with your care today." : "Your consultations, home visits, and prescriptions — all in one place."}
        </Text>

        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.href}
              style={({ pressed }) => [styles.quickAction, pressed && styles.cardPressed]}
              onPress={() => router.push(action.href)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={action.icon} size={20} color={colors.brand.foreground} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Section title="Your consultation">
          {booking ? (
            <View style={styles.card}>
              <View style={styles.doctorRow}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{booking.doctor.name[0]}</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.doctorName}>{booking.doctor.name}</Text>
                  <Text style={styles.meta}>{booking.doctor.specialty}</Text>
                  <Text style={styles.meta}>{formatKarachi(booking.scheduledStart)}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{ONLINE_STATUS_LABEL[booking.status] ?? booking.status}</Text>
                </View>
              </View>
              {canJoin ? (
                <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.cardPressed]} onPress={onJoin} disabled={isJoining}>
                  <Ionicons name="videocam" size={16} color={colors.brand.foreground} />
                  <Text style={styles.primaryButtonText}>{isJoining ? "Joining…" : "Join call"}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.cardPressed]}
                onPress={() => router.push({ pathname: "/intake/[appointmentId]", params: { appointmentId: booking.appointmentId } })}
              >
                <Text style={styles.secondaryButtonText}>Share medical history</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.brand.DEFAULT} />
              </Pressable>
            </View>
          ) : (
            <EmptyCard
              icon="videocam-outline"
              title="No upcoming consultation"
              hint="Find a doctor and book an online video consult."
              actionLabel="Find a doctor"
              onPress={() => router.push("/(tabs)/doctors")}
              error={hasBookingError}
            />
          )}
        </Section>

        <Section title="Home visits">
          {nextVisit ? (
            <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => router.push("/home-visit")}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.doctorName}>{nextVisit.serviceType.replace("_", " ")}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{VISIT_STATUS_LABEL[nextVisit.status] ?? nextVisit.status}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color="#8A8F98" />
                <Text style={styles.meta} numberOfLines={1}>{nextVisit.address.line}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color="#8A8F98" />
                <Text style={styles.meta}>{formatKarachi(nextVisit.scheduledAt)}</Text>
              </View>
            </Pressable>
          ) : (
            <EmptyCard
              icon="home-outline"
              title="No home visits scheduled"
              hint="Doctor, nurse, or physiotherapy — right at your doorstep."
              actionLabel="Request a visit"
              onPress={() => router.push("/home-visit/request")}
            />
          )}
        </Section>

        <TrustBadges />

        {recentRx.length > 0 ? (
          <Section title="Recent prescriptions" onSeeAll={() => router.push("/prescription")}>
            <View style={{ gap: 10 }}>
              {recentRx.map((rx) => (
                <Pressable
                  key={rx.id}
                  style={({ pressed }) => [styles.rxRow, pressed && styles.cardPressed]}
                  onPress={() => router.push({ pathname: "/prescription/[id]", params: { id: rx.id } })}
                >
                  <View style={styles.rxIconWrap}>
                    <Text style={styles.rxIcon}>Rx</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.doctorName}>{rx.doctorName}</Text>
                    <Text style={styles.meta}>{formatKarachi(rx.issuedAt)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                </Pressable>
              ))}
            </View>
          </Section>
        ) : null}
      </View>
    </ScrollView>
  );
}

const TRUST_BADGES: { icon: IconName; label: string; hint: string }[] = [
  { icon: "shield-checkmark-outline", label: "PMC Verified Doctors", hint: "Every doctor is verified." },
  { icon: "cash-outline", label: "100% Secure Payment", hint: "Your card details are never stored." },
  {
    icon: "refresh-circle-outline",
    label: "Full Refund Guarantee",
    hint: "Refunded in full if your doctor is unavailable or you cancel before the consult.",
  },
  { icon: "headset-outline", label: "Support on Call", hint: "We're here to help 24/7." },
];

function TrustBadges() {
  return (
    <View style={styles.trustCard}>
      {TRUST_BADGES.map((badge, index) => (
        <View
          key={badge.label}
          style={[styles.trustRow, index === TRUST_BADGES.length - 1 && { marginBottom: 0 }]}
        >
          <View style={styles.trustIconWrap}>
            <Ionicons name={badge.icon} size={18} color={colors.brand.DEFAULT} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.doctorName}>{badge.label}</Text>
            <Text style={styles.meta}>{badge.hint}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Section({ title, onSeeAll, children }: { title: string; onSeeAll?: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function EmptyCard({
  icon,
  title,
  hint,
  actionLabel,
  onPress,
  error,
}: {
  icon: IconName;
  title: string;
  hint: string;
  actionLabel: string;
  onPress: () => void;
  error?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.emptyRow}>
        <View style={styles.quickActionIconLight}>
          <Ionicons name={icon} size={22} color={colors.brand.DEFAULT} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.doctorName}>{error ? "Couldn't load this" : title}</Text>
          <Text style={styles.meta}>{error ? "Pull down to try again." : hint}</Text>
        </View>
      </View>
      <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.cardPressed]} onPress={onPress}>
        <Text style={styles.secondaryButtonText}>{actionLabel}</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.brand.DEFAULT} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { paddingBottom: 40 },
  hero: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 16,
  },
  heroTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroEyebrow: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.75)" },
  heroGreeting: { fontFamily: fonts.bold, fontSize: 24, color: "#fff", marginTop: 2 },
  heroHint: { fontFamily: fonts.regular, fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 19 },
  heroAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarInitial: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
  body: { padding: 20, gap: 24, marginTop: -8 },
  quickActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  quickAction: {
    flexBasis: "18%",
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingVertical: 12,
  },
  cardPressed: { opacity: 0.85 },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionIconLight: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brand.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#fff",
    textAlign: "center",
  },
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  seeAll: { fontFamily: fonts.medium, fontSize: 13, color: colors.brand.DEFAULT },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    ...cardShadow,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  doctorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.neutral.muted },
  avatarPlaceholder: { backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.bold, color: colors.brand.mutedForeground, fontSize: 18 },
  cardBody: { flex: 1, gap: 2 },
  doctorName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground, textTransform: "capitalize" },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: "#666" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusPill: { backgroundColor: colors.brand.muted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brand.mutedForeground },
  primaryButton: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 14 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  secondaryButton: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.brand.muted,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: colors.brand.mutedForeground, fontFamily: fonts.semibold, fontSize: 13 },
  trustCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, ...cardShadow },
  trustRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  trustIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brand.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  rxRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 12, ...cardShadow },
  rxIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  rxIcon: { fontFamily: fonts.bold, fontSize: 13, color: colors.brand.mutedForeground },
});
