import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Alert,
  Image,
  ImageBackground,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/locale-context";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { resolveMediaUrl, SUPPORT_PHONE_TEL_URL, SUPPORT_WHATSAPP_URL } from "@/lib/config";
import { formatKarachi } from "@/lib/format-date";
import { getOnlineBooking, type OnlineBooking } from "@/api/dashboard";
import { listMyHomeVisits, type HomeVisitDto } from "@/api/home-visits";
import { listPrescriptions, type PrescriptionSummary } from "@/api/prescriptions";
import { listConsultDoctors, type ConsultDoctorRow } from "@/api/consult";
import { joinVideoSession } from "@/api/appointments";
import { ApiRequestError } from "@/api/client";
import { SPECIALTIES } from "@zindagi/shared/constants/specialties";
import type { MobileDictionary } from "@zindagi/i18n";

type IconName = keyof typeof Ionicons.glyphMap;

type QuickActionHref = "/(tabs)/doctors" | "/home-visit" | "/prescription" | "/(tabs)/appointments";

function quickActions(t: MobileDictionary): { icon: IconName; label: string; href: QuickActionHref }[] {
  return [
    { icon: "medkit-outline", label: t.home.quickActions.bookConsult, href: "/(tabs)/doctors" },
    { icon: "home-outline", label: t.home.quickActions.homeVisit, href: "/home-visit" },
    { icon: "calendar-outline", label: t.home.quickActions.appointments, href: "/(tabs)/appointments" },
    { icon: "document-text-outline", label: t.home.quickActions.prescriptions, href: "/prescription" },
  ];
}

type PromoHref = "/sunday-consult" | "/home-visit/request" | "/(tabs)/doctors";

function promoSlides(t: MobileDictionary): {
  key: string;
  badge: string;
  title: string;
  subtitle: string;
  action: string;
  href: PromoHref;
  /** Same brand photography already used for these hero banners on the web marketing site. */
  image: string;
}[] {
  return [
    {
      key: "free-consultation",
      badge: t.home.freeConsultation.badge,
      title: t.home.freeConsultation.title,
      subtitle: t.home.freeConsultation.subtitle,
      action: t.home.freeConsultation.action,
      href: "/sunday-consult",
      image: "/hero/freeconsultation.png",
    },
    {
      key: "home-care",
      badge: t.home.promoCarousel.homeCare.badge,
      title: t.home.promoCarousel.homeCare.title,
      subtitle: t.home.promoCarousel.homeCare.subtitle,
      action: t.home.promoCarousel.homeCare.action,
      href: "/home-visit/request",
      image: "/hero/home-care-pakistan.jpg",
    },
    {
      key: "find-doctor",
      badge: t.home.promoCarousel.findDoctor.badge,
      title: t.home.promoCarousel.findDoctor.title,
      subtitle: t.home.promoCarousel.findDoctor.subtitle,
      action: t.home.promoCarousel.findDoctor.action,
      href: "/(tabs)/doctors",
      image: "/hero/online-consult.jpg",
    },
  ];
}

const PROMO_INTERVAL_MS = 3000;

const SERVICE_ICONS: Record<string, IconName> = {
  Dermatologist: "body-outline",
  Gynecologist: "female-outline",
  "ENT Specialist": "ear-outline",
  Pediatrician: "happy-outline",
  "Orthopedic Surgeon": "walk-outline",
  "General Physician": "medkit-outline",
  Neurologist: "pulse-outline",
  Urologist: "water-outline",
};
const HEALTHCARE_SERVICES = SPECIALTIES.slice(0, 8);

const ACTIVE_VISIT_STATUSES = new Set(["requested", "assigned", "en_route", "arrived"]);

export default function HomeScreen() {
  const { user } = useAuth();
  const t = useTranslations();
  const router = useRouter();
  const QUICK_ACTIONS = quickActions(t);
  const PROMO_SLIDES = promoSlides(t);
  const ONLINE_STATUS_LABEL = t.home.onlineStatus;
  const VISIT_STATUS_LABEL = t.home.visitStatus;

  const promoScrollRef = useRef<ScrollView>(null);
  const [promoWidth, setPromoWidth] = useState(0);
  const [promoIndex, setPromoIndex] = useState(0);

  const [booking, setBooking] = useState<OnlineBooking | null>(null);
  const [hasBookingError, setHasBookingError] = useState(false);
  const [nextVisit, setNextVisit] = useState<HomeVisitDto | null>(null);
  const [recentRx, setRecentRx] = useState<PrescriptionSummary[]>([]);
  const [recommended, setRecommended] = useState<ConsultDoctorRow[]>([]);
  const [hasRecommendedError, setHasRecommendedError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const load = useCallback(async () => {
    const [bookingResult, visitsResult, rxResult, doctorsResult] = await Promise.allSettled([
      getOnlineBooking(),
      listMyHomeVisits(),
      listPrescriptions(),
      listConsultDoctors({ city: "Lahore" }),
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

    if (doctorsResult.status === "fulfilled") {
      setRecommended(doctorsResult.value.filter((d) => !d.isFull).slice(0, 6));
      setHasRecommendedError(false);
    } else {
      setHasRecommendedError(true);
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
      Alert.alert(t.home.joinErrorTitle, e instanceof ApiRequestError ? e.message : t.home.joinErrorMessage);
    } finally {
      setIsJoining(false);
    }
  };

  const onHelp = async () => {
    try {
      await Linking.openURL(SUPPORT_WHATSAPP_URL);
    } catch {
      Alert.alert(t.home.helpErrorTitle, t.home.helpErrorMessage, [
        { text: t.common.cancel, style: "cancel" },
        { text: t.home.helpCall, onPress: () => Linking.openURL(SUPPORT_PHONE_TEL_URL) },
      ]);
    }
  };

  useEffect(() => {
    if (!promoWidth || PROMO_SLIDES.length < 2) return;
    const id = setInterval(() => {
      setPromoIndex((prev) => {
        const next = (prev + 1) % PROMO_SLIDES.length;
        promoScrollRef.current?.scrollTo({ x: next * promoWidth, animated: true });
        return next;
      });
    }, PROMO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [promoWidth, PROMO_SLIDES.length]);

  const onPromoScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!promoWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / promoWidth);
    setPromoIndex(index);
  };

  const avatarUri = resolveMediaUrl(booking?.doctor.avatarUrl);
  const canJoin = booking?.status === "confirmed" || booking?.status === "in_progress";
  const firstName = user?.name ? user.name.split(" ")[0] : "";
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
          <View style={styles.locationPill}>
            <View style={styles.locationIconWrap}>
              <Ionicons name="location" size={16} color={colors.brand.dark} />
            </View>
            <View>
              <Text style={styles.locationLabel}>{t.home.location.label.toUpperCase()}</Text>
              <Text style={styles.locationValue}>{t.home.location.city}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.helpPill, pressed && styles.cardPressed]}
            onPress={onHelp}
            accessibilityRole="button"
            accessibilityLabel={t.home.help}
          >
            <Ionicons name="headset-outline" size={16} color="#fff" />
            <Text style={styles.helpPillText}>{t.home.help.toUpperCase()}</Text>
          </Pressable>
        </View>

        <Text style={styles.heroGreeting}>
          {t.home.greetingPrefix}, {firstName || t.home.fallbackName}
        </Text>
        <Text style={styles.heroHint}>
          {hasActivity ? t.home.heroHintActive : t.home.subtitle}
        </Text>

        <Pressable
          style={({ pressed }) => [styles.searchBar, pressed && styles.cardPressed]}
          onPress={() => router.push("/(tabs)/doctors")}
          accessibilityRole="button"
          accessibilityLabel={t.home.search.placeholder}
        >
          <Ionicons name="search-outline" size={18} color="#9AA5B1" />
          <Text style={styles.searchBarText}>{t.home.search.placeholder}</Text>
          <View style={styles.searchBarDivider} />
          <Ionicons name="options-outline" size={18} color={colors.brand.DEFAULT} />
        </Pressable>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.href}
              style={({ pressed }) => [styles.quickAction, pressed && styles.cardPressed]}
              onPress={() => router.push(action.href)}
              accessibilityRole="button"
              accessibilityLabel={action.label.replace(/\n/g, " ")}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={action.icon} size={22} color={colors.brand.DEFAULT} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <Section title={t.home.consultationSection}>
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
                  <Text style={styles.statusText}>
                    {(ONLINE_STATUS_LABEL as Record<string, string>)[booking.status] ?? booking.status}
                  </Text>
                </View>
              </View>
              {canJoin ? (
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.cardPressed]}
                  onPress={onJoin}
                  disabled={isJoining}
                  accessibilityRole="button"
                  accessibilityLabel={isJoining ? t.home.joining : t.home.joinCall}
                  accessibilityState={{ disabled: isJoining, busy: isJoining }}
                >
                  <Ionicons name="videocam" size={16} color={colors.brand.foreground} />
                  <Text style={styles.primaryButtonText}>{isJoining ? t.home.joining : t.home.joinCall}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.cardPressed]}
                onPress={() => router.push({ pathname: "/intake/[appointmentId]", params: { appointmentId: booking.appointmentId } })}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>{t.home.shareMedicalHistory}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.brand.DEFAULT} />
              </Pressable>
            </View>
          ) : (
            <EmptyCard
              icon="videocam-outline"
              title={t.home.noConsultation.title}
              hint={t.home.noConsultation.hint}
              actionLabel={t.home.noConsultation.action}
              onPress={() => router.push("/(tabs)/doctors")}
              error={hasBookingError}
              errorTitle={t.home.noConsultation.errorTitle}
              errorHint={t.home.noConsultation.errorHint}
            />
          )}
        </Section>

        <Section title={t.home.homeVisitsSection}>
          {nextVisit ? (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push("/home-visit")}
              accessibilityRole="button"
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.doctorName}>{nextVisit.serviceType.replace("_", " ")}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>
                    {(VISIT_STATUS_LABEL as Record<string, string>)[nextVisit.status] ?? nextVisit.status}
                  </Text>
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
              title={t.home.noHomeVisit.title}
              hint={t.home.noHomeVisit.hint}
              actionLabel={t.home.noHomeVisit.action}
              onPress={() => router.push("/home-visit/request")}
            />
          )}
        </Section>

        <View onLayout={(e) => setPromoWidth(e.nativeEvent.layout.width)}>
          <ScrollView
            ref={promoScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPromoScrollEnd}
          >
            {PROMO_SLIDES.map((slide) => (
              <Pressable
                key={slide.key}
                style={({ pressed }) => [
                  styles.promoCard,
                  promoWidth ? { width: promoWidth } : null,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => router.push(slide.href)}
                accessibilityRole="button"
                accessibilityLabel={slide.title}
              >
                <ImageBackground
                  source={{ uri: resolveMediaUrl(slide.image) }}
                  style={styles.promoImageBg}
                  imageStyle={styles.promoImageRadius}
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={["rgba(4,20,30,0)", "rgba(4,20,30,0.55)", "rgba(4,20,30,0.88)"]}
                    locations={[0, 0.5, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.promoContent}>
                    <View style={styles.promoBadge}>
                      <Text style={styles.promoBadgeText}>{slide.badge}</Text>
                    </View>
                    <Text style={styles.promoTitle}>{slide.title}</Text>
                    <Text style={styles.promoSubtitle}>{slide.subtitle}</Text>
                    <View style={styles.promoAction}>
                      <Text style={styles.promoActionText}>{slide.action}</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.accent.DEFAULT} />
                    </View>
                  </View>
                </ImageBackground>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.promoDots}>
            {PROMO_SLIDES.map((slide, i) => (
              <View key={slide.key} style={[styles.promoDot, i === promoIndex && styles.promoDotActive]} />
            ))}
          </View>
        </View>

        {recommended.length > 0 || hasRecommendedError ? (
          <Section
            title={t.home.recommendedDoctors.title}
            onSeeAll={() => router.push("/(tabs)/doctors")}
            seeAllLabel={t.home.recommendedDoctors.seeAll}
          >
            {hasRecommendedError ? (
              <Text style={styles.errorText}>{t.home.recommendedDoctors.loadError}</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.doctorCarousel}
              >
                {recommended.map((doc) => {
                  const docAvatar = resolveMediaUrl(doc.avatarUrl);
                  return (
                    <Pressable
                      key={doc.doctorId}
                      style={({ pressed }) => [styles.doctorCard, pressed && styles.cardPressed]}
                      onPress={() => router.push({ pathname: "/doctor/[doctorId]", params: { doctorId: doc.doctorId } })}
                      accessibilityRole="button"
                    >
                      {docAvatar ? (
                        <Image source={{ uri: docAvatar }} style={styles.doctorCardAvatar} />
                      ) : (
                        <View style={[styles.doctorCardAvatar, styles.avatarPlaceholder]}>
                          <Text style={styles.avatarInitial}>{doc.name[0]}</Text>
                        </View>
                      )}
                      <Text style={styles.doctorName} numberOfLines={1}>{doc.name}</Text>
                      <Text style={styles.meta} numberOfLines={1}>{doc.specialties[0] ?? ""}</Text>
                      <View style={styles.metaRow}>
                        <Ionicons name="star" size={13} color="#F5A623" />
                        <Text style={styles.rating}>{doc.ratingAvg.toFixed(1)}</Text>
                      </View>
                      <View style={styles.doctorCardFooter}>
                        <Text style={styles.doctorCardFee}>Rs. {doc.consultationFee}</Text>
                        <View style={styles.bookPill}>
                          <Text style={styles.bookPillText}>{t.home.recommendedDoctors.bookNow}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Section>
        ) : null}

        <Section title={t.home.healthcareServices.title}>
          <View style={styles.servicesGrid}>
            {HEALTHCARE_SERVICES.map((specialty) => (
              <Pressable
                key={specialty}
                style={({ pressed }) => [styles.serviceTile, pressed && styles.cardPressed]}
                onPress={() => router.push({ pathname: "/(tabs)/doctors", params: { specialty } })}
                accessibilityRole="button"
                accessibilityLabel={specialty}
              >
                <View style={styles.serviceIconWrap}>
                  <Ionicons name={SERVICE_ICONS[specialty] ?? "medkit-outline"} size={20} color={colors.brand.DEFAULT} />
                </View>
                <Text style={styles.serviceLabel} numberOfLines={2}>{specialty}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <TrustBadges t={t} />

        {recentRx.length > 0 ? (
          <Section title={t.home.recentPrescriptionsSection} onSeeAll={() => router.push("/prescription")} seeAllLabel={t.home.seeAll}>
            <View style={{ gap: 10 }}>
              {recentRx.map((rx) => (
                <Pressable
                  key={rx.id}
                  style={({ pressed }) => [styles.rxRow, pressed && styles.cardPressed]}
                  onPress={() => router.push({ pathname: "/prescription/[id]", params: { id: rx.id } })}
                  accessibilityRole="button"
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

function TrustBadges({ t }: { t: MobileDictionary }) {
  const TRUST_BADGES: { icon: IconName; label: string }[] = [
    { icon: "shield-checkmark-outline", label: t.home.trustBadges.verified.label },
    { icon: "cash-outline", label: t.home.trustBadges.payment.label },
    { icon: "refresh-circle-outline", label: t.home.trustBadges.refund.label },
    { icon: "headset-outline", label: t.home.trustBadges.support.label },
  ];
  return (
    <View style={styles.trustRow}>
      {TRUST_BADGES.map((badge) => (
        <View key={badge.label} style={styles.trustItem}>
          <Ionicons name={badge.icon} size={18} color={colors.brand.DEFAULT} />
          <Text style={styles.trustLabel} numberOfLines={2}>{badge.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({
  title,
  onSeeAll,
  seeAllLabel,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={seeAllLabel}>
            <Text style={styles.seeAll}>{seeAllLabel}</Text>
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
  errorTitle,
  errorHint,
}: {
  icon: IconName;
  title: string;
  hint: string;
  actionLabel: string;
  onPress: () => void;
  error?: boolean;
  errorTitle?: string;
  errorHint?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.emptyRow}>
        <View style={styles.quickActionIconLight}>
          <Ionicons name={icon} size={22} color={colors.brand.DEFAULT} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.doctorName}>{error ? errorTitle : title}</Text>
          <Text style={styles.meta}>{error ? errorHint : hint}</Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.cardPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
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
    gap: 14,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingRight: 16,
    paddingLeft: 6,
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  locationLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.7)",
  },
  locationValue: { fontFamily: fonts.bold, fontSize: 14, color: "#fff", marginTop: 1 },
  helpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  helpPillText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.4, color: "#fff" },
  heroGreeting: { fontFamily: fonts.bold, fontSize: 26, color: "#fff", marginTop: 6 },
  heroHint: { fontFamily: fonts.regular, fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 20 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...cardShadow,
  },
  searchBarText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: "#8A8F98" },
  searchBarDivider: { width: 1, height: 20, backgroundColor: colors.neutral.border },
  body: { padding: 20, gap: 24 },
  quickActions: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  quickAction: {
    flexBasis: "23%",
    flexGrow: 1,
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    ...cardShadow,
  },
  cardPressed: { opacity: 0.85 },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brand.muted,
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
    color: colors.neutral.foreground,
    textAlign: "center",
  },
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  seeAll: { fontFamily: fonts.medium, fontSize: 13, color: colors.brand.DEFAULT },
  errorText: { fontFamily: fonts.regular, fontSize: 13, color: "#c62828" },
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
  promoCard: { height: 190, borderRadius: 18, overflow: "hidden", ...cardShadow },
  promoImageBg: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.neutral.muted },
  promoImageRadius: { borderRadius: 18 },
  promoContent: { padding: 18, gap: 6 },
  promoBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  promoBadgeText: { fontFamily: fonts.semibold, fontSize: 11, color: "#fff" },
  promoTitle: { fontFamily: fonts.bold, fontSize: 19, color: "#fff" },
  promoSubtitle: { fontFamily: fonts.regular, fontSize: 13, color: "rgba(255,255,255,0.88)", lineHeight: 19 },
  promoAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  promoActionText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent.DEFAULT },
  promoDots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  promoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.neutral.border },
  promoDotActive: { width: 18, backgroundColor: colors.brand.DEFAULT },
  doctorCarousel: { gap: 12, paddingRight: 4 },
  doctorCard: {
    width: 168,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 4,
    ...cardShadow,
  },
  doctorCardAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.neutral.muted, marginBottom: 4 },
  rating: { fontFamily: fonts.semibold, fontSize: 12, color: colors.neutral.foreground },
  doctorCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  doctorCardFee: { fontFamily: fonts.semibold, fontSize: 13, color: colors.neutral.foreground },
  bookPill: { backgroundColor: colors.brand.muted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  bookPillText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brand.mutedForeground },
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  serviceTile: {
    flexBasis: "23%",
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    ...cardShadow,
  },
  serviceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brand.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.neutral.foreground, textAlign: "center" },
  trustRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    ...cardShadow,
  },
  trustItem: { flex: 1, alignItems: "center", gap: 6 },
  trustLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: "#666", textAlign: "center" },
  rxRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 12, ...cardShadow },
  rxIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  rxIcon: { fontFamily: fonts.bold, fontSize: 13, color: colors.brand.mutedForeground },
});
