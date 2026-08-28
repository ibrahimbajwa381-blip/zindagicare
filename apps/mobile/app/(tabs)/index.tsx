import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

const QUICK_ACTIONS: { icon: IconName; label: string; href: "/(tabs)/doctors" | "/home-visit" | "/prescription" | "/(tabs)/appointments" }[] = [
  { icon: "medkit-outline", label: "Book\nconsult", href: "/(tabs)/doctors" },
  { icon: "home-outline", label: "Home\nvisit", href: "/home-visit" },
  { icon: "document-text-outline", label: "Prescrip-\ntions", href: "/prescription" },
  { icon: "calendar-outline", label: "Appoint-\nments", href: "/(tabs)/appointments" },
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View>
        <Text style={styles.greeting}>Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</Text>
        <Text style={styles.hint}>Your consultations, home visits, and prescriptions — all in one place.</Text>
      </View>

      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.href}
            style={({ pressed }) => [styles.quickAction, pressed && styles.cardPressed]}
            onPress={() => router.push(action.href)}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name={action.icon} size={22} color={colors.brand.DEFAULT} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

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
              <Pressable style={styles.primaryButton} onPress={onJoin} disabled={isJoining}>
                <Text style={styles.primaryButtonText}>{isJoining ? "Joining…" : "Join call"}</Text>
              </Pressable>
            ) : null}
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
          <Pressable style={styles.card} onPress={() => router.push("/home-visit")}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.doctorName}>{nextVisit.serviceType.replace("_", " ")}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{VISIT_STATUS_LABEL[nextVisit.status] ?? nextVisit.status}</Text>
              </View>
            </View>
            <Text style={styles.meta} numberOfLines={1}>{nextVisit.address.line}</Text>
            <Text style={styles.meta}>{formatKarachi(nextVisit.scheduledAt)}</Text>
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

      {recentRx.length > 0 ? (
        <Section title="Recent prescriptions" onSeeAll={() => router.push("/prescription")}>
          <View style={{ gap: 10 }}>
            {recentRx.map((rx) => (
              <Pressable
                key={rx.id}
                style={styles.rxRow}
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
    </ScrollView>
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
        <View style={styles.quickActionIcon}>
          <Ionicons name={icon} size={22} color={colors.brand.DEFAULT} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.doctorName}>{error ? "Couldn't load this" : title}</Text>
          <Text style={styles.meta}>{error ? "Pull down to try again." : hint}</Text>
        </View>
      </View>
      <Pressable style={styles.secondaryButton} onPress={onPress}>
        <Text style={styles.secondaryButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  greeting: { fontSize: 22, fontFamily: fonts.bold, color: colors.neutral.foreground },
  hint: { color: "#666", fontFamily: fonts.regular, marginTop: 2 },
  quickActions: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  quickAction: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    ...cardShadow,
  },
  cardPressed: { opacity: 0.85 },
  quickActionIcon: {
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
    color: colors.neutral.foreground,
    textAlign: "center",
  },
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  seeAll: { fontFamily: fonts.medium, fontSize: 13, color: colors.brand.DEFAULT },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
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
  statusPill: { backgroundColor: colors.brand.muted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brand.mutedForeground },
  primaryButton: { backgroundColor: colors.brand.DEFAULT, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  primaryButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 14 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  secondaryButton: { backgroundColor: colors.neutral.muted, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  secondaryButtonText: { color: colors.neutral.foreground, fontFamily: fonts.medium, fontSize: 13 },
  rxRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 12, ...cardShadow },
  rxIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  rxIcon: { fontFamily: fonts.bold, fontSize: 13, color: colors.brand.mutedForeground },
});
