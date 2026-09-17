import { useEffect, useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import {
  getConsultDoctor,
  listConsultSlots,
  type ConsultDoctorProfile,
  type ConsultDoctorReview,
  type ConsultSlot,
} from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/config";
import { formatKarachiDate as reviewDate, formatKarachiTime as timeLabel } from "@/lib/format-date";
import { initials } from "@/lib/format-name";

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function qualificationBadges(doctor: ConsultDoctorProfile) {
  const list = doctor.medicalDegree
    ? [doctor.medicalDegree, ...doctor.qualifications]
    : doctor.qualifications;
  return [...new Set(list.filter(Boolean))];
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < Math.round(rating) ? "star" : "star-outline"}
          size={size}
          color="#F5A623"
        />
      ))}
    </View>
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

const REVIEW_PREVIEW_COUNT = 3;

export default function DoctorProfileScreen() {
  const { doctorId } = useLocalSearchParams<{ doctorId: string }>();
  const router = useRouter();
  const [doctor, setDoctor] = useState<ConsultDoctorProfile | null>(null);
  const [reviews, setReviews] = useState<ConsultDoctorReview[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [slots, setSlots] = useState<ConsultSlot[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guards against an in-flight request for a previous doctorId resolving after
    // a newer one and silently overwriting it with the wrong doctor's data.
    let isCurrent = true;

    getConsultDoctor(doctorId)
      .then((res) => {
        if (!isCurrent) return;
        setDoctor(res.doctor);
        setReviews(res.reviews);
        setReviewTotal(res.reviewTotal);
      })
      .catch((e) => {
        if (!isCurrent) return;
        setError(e instanceof ApiRequestError ? e.message : "Failed to load doctor");
      });
    listConsultSlots(doctorId)
      .then((res) => {
        if (!isCurrent) return;
        setSlots(res.slots);
      })
      .catch(() => {
        if (!isCurrent) return;
        setSlots([]);
      });

    return () => {
      isCurrent = false;
    };
  }, [doctorId]);

  const grouped = useMemo(() => {
    if (!slots) return [];
    const map = new Map<string, ConsultSlot[]>();
    for (const slot of slots) {
      if (slot.status !== "available") continue;
      const key = dayKey(slot.startAt);
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  useEffect(() => {
    if (grouped.length === 0) {
      setSelectedDay(null);
      return;
    }
    setSelectedDay((current) => (current && grouped.some(([key]) => key === current) ? current : grouped[0][0]));
  }, [grouped]);

  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, REVIEW_PREVIEW_COUNT);
  const activeDaySlots = grouped.find(([key]) => key === selectedDay)?.[1] ?? [];

  if (!doctor) {
    return (
      <>
        <Stack.Screen options={{ title: "Doctor profile" }} />
        {error ? (
          <View style={styles.centered}>
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          </View>
        ) : (
          <BrandLoadingScreen />
        )}
      </>
    );
  }

  const avatarUri = resolveMediaUrl(doctor.avatarUrl);
  const credentials = qualificationBadges(doctor);
  const primaryHospital = doctor.hospitals[0];

  return (
    <>
      <Stack.Screen options={{ title: doctor.name }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{initials(doctor.name)}</Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{doctor.name}</Text>
                {doctor.pmdcVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.brand.mutedForeground} />
                    <Text style={styles.verifiedBadgeText}>PMDC</Text>
                  </View>
                ) : null}
              </View>
              {doctor.specialties.length > 0 ? (
                <Text style={styles.specialty}>{doctor.specialties.join(" · ")}</Text>
              ) : null}
              {primaryHospital ? (
                <View style={styles.hospitalRow}>
                  <Ionicons name="business" size={13} color={colors.brand.DEFAULT} />
                  <Text style={styles.hospital} numberOfLines={1}>
                    {primaryHospital.name}, {primaryHospital.city}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {credentials.length > 0 ? (
            <View style={styles.badgeRow}>
              {credentials.map((c) => (
                <View key={c} style={styles.credentialBadge}>
                  <Text style={styles.credentialBadgeText}>{c}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={15} color="#F5A623" />
              <Text style={styles.metaValue}>{doctor.ratingAvg.toFixed(1)}</Text>
              <Text style={styles.metaSub}>({doctor.ratingCount})</Text>
            </View>
            {doctor.experienceYears > 0 ? (
              <View style={styles.metaItem}>
                <Ionicons name="ribbon" size={15} color={colors.accent.DEFAULT} />
                <Text style={styles.metaSub}>{doctor.experienceYears}+ yrs experience</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeValue}>Rs. {doctor.consultationFee.toLocaleString()}</Text>
            <Text style={styles.feeLabel}>per consultation</Text>
          </View>
        </View>

        {doctor.bio ? (
          <Section title="About" icon="medkit">
            <Text style={styles.bodyText}>{doctor.bio}</Text>
          </Section>
        ) : null}

        {credentials.length > 0 || doctor.medicalCollege ? (
          <Section title="Education" icon="school">
            {credentials.map((c) => (
              <Text key={c} style={styles.listItem}>
                • {c}
              </Text>
            ))}
            {doctor.medicalCollege ? (
              <Text style={styles.listItem}>
                • {doctor.medicalCollege}
                {doctor.graduationYear ? ` · ${doctor.graduationYear}` : ""}
              </Text>
            ) : null}
          </Section>
        ) : null}

        {doctor.hospitals.length > 0 ? (
          <Section title="Practices at" icon="location">
            {doctor.hospitals.map((h) => (
              <View key={`${h.name}-${h.city}`} style={styles.hospitalCard}>
                <Text style={styles.hospitalCardName}>{h.name}</Text>
                <Text style={styles.hospitalCardSub}>
                  {h.city}
                  {h.address ? ` · ${h.address}` : ""}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {doctor.languages.length > 0 ? (
          <Section title="Languages" icon="chatbubbles">
            <Text style={styles.bodyText}>{doctor.languages.join(", ")}</Text>
          </Section>
        ) : null}

        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            {reviewTotal > 0 ? <Text style={styles.reviewTotal}>{reviewTotal} total</Text> : null}
          </View>
          {reviews.length === 0 ? (
            <Text style={styles.hint}>No reviews yet.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {visibleReviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHead}>
                    <View>
                      <Text style={styles.reviewName}>{review.patientName}</Text>
                      <Text style={styles.reviewDate}>{reviewDate(review.createdAt)}</Text>
                    </View>
                    <Stars rating={review.rating} />
                  </View>
                  {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                </View>
              ))}
              {reviews.length > REVIEW_PREVIEW_COUNT ? (
                <Pressable
                  style={styles.seeMoreButton}
                  onPress={() => setShowAllReviews((v) => !v)}
                  accessibilityRole="button"
                >
                  <Text style={styles.seeMoreText}>
                    {showAllReviews ? "Show less" : `See ${reviews.length - REVIEW_PREVIEW_COUNT} more reviews`}
                  </Text>
                  <Ionicons
                    name={showAllReviews ? "chevron-up" : "chevron-down"}
                    size={15}
                    color={colors.brand.DEFAULT}
                  />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        <Section title="Select a time" icon="calendar">
          {!slots ? (
            <View style={styles.centered}>
              <Text style={styles.hint}>Loading available slots…</Text>
            </View>
          ) : grouped.length === 0 ? (
            <Text style={styles.hint}>No available slots in the next two weeks.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                {grouped.map(([key, daySlots]) => {
                  const active = key === selectedDay;
                  return (
                    <Pressable
                      key={key}
                      style={[styles.dateChip, active && styles.dateChipActive]}
                      onPress={() => setSelectedDay(key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                        {dayLabel(daySlots[0].startAt)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {activeDaySlots.length > 0 ? (
                <View style={styles.slotRow}>
                  {activeDaySlots.map((slot) => (
                    <Pressable
                      key={slot.slotId}
                      style={({ pressed }) => [styles.slotChip, pressed && styles.slotChipPressed]}
                      onPress={() =>
                        router.push({
                          pathname: "/checkout",
                          params: { doctorId, slotId: slot.slotId, startAt: slot.startAt },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Book ${timeLabel(slot.startAt)} slot`}
                    >
                      {({ pressed }) => (
                        <Text style={[styles.slotText, pressed && styles.slotTextPressed]}>
                          {timeLabel(slot.startAt)}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </Section>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  centered: { alignItems: "center", justifyContent: "center", padding: 24 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },

  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    gap: 14,
    ...cardShadow,
  },
  headerTop: { flexDirection: "row", gap: 14 },
  avatar: { width: 84, height: 84, borderRadius: 20, backgroundColor: colors.neutral.muted },
  avatarPlaceholder: { backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.bold, color: colors.brand.mutedForeground, fontSize: 28 },
  headerInfo: { flex: 1, gap: 4, justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontFamily: fonts.bold, fontSize: 19, color: colors.neutral.foreground, flexShrink: 1 },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.brand.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: { fontFamily: fonts.medium, fontSize: 10, color: colors.brand.mutedForeground },
  specialty: { fontFamily: fonts.medium, fontSize: 14, color: colors.accent.DEFAULT },
  hospitalRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  hospital: { fontFamily: fonts.regular, fontSize: 12, color: "#666", flexShrink: 1 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  credentialBadge: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  credentialBadgeText: { fontFamily: fonts.medium, fontSize: 11, color: "#444" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaValue: { fontFamily: fonts.semibold, fontSize: 13, color: "#F5A623" },
  metaSub: { fontFamily: fonts.regular, fontSize: 12, color: "#666" },
  feeRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    paddingTop: 12,
  },
  feeValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.brand.mutedForeground },
  feeLabel: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    ...cardShadow,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  bodyText: { fontFamily: fonts.regular, fontSize: 13, color: "#555", lineHeight: 20 },
  listItem: { fontFamily: fonts.regular, fontSize: 13, color: "#555", lineHeight: 20 },

  hospitalCard: {
    backgroundColor: colors.neutral.muted,
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  hospitalCardName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.neutral.foreground },
  hospitalCardSub: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },

  dateRow: { flexDirection: "row", gap: 8, paddingBottom: 2 },
  dateChip: {
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.neutral.muted,
  },
  dateChipActive: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.brand.DEFAULT },
  dateChipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.neutral.foreground },
  dateChipTextActive: { color: colors.brand.foreground, fontFamily: fonts.semibold },
  slotRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotChip: {
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: colors.brand.muted,
  },
  slotChipPressed: { backgroundColor: colors.brand.DEFAULT },
  slotText: { color: colors.brand.mutedForeground, fontFamily: fonts.semibold, fontSize: 13 },
  slotTextPressed: { color: colors.brand.foreground },

  seeMoreButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 6 },
  seeMoreText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brand.DEFAULT },
  reviewsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewTotal: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },
  reviewCard: {
    backgroundColor: colors.neutral.muted,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  reviewHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  reviewName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.neutral.foreground },
  reviewDate: { fontFamily: fonts.regular, fontSize: 11, color: "#999" },
  reviewComment: { fontFamily: fonts.regular, fontSize: 13, color: "#555", lineHeight: 19 },
});
