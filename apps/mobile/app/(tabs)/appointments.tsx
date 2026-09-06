import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import {
  getAppointmentHistory,
  joinVideoSession,
  submitAppointmentReview,
  type AppointmentHistoryItem,
} from "@/api/appointments";
import { ApiRequestError } from "@/api/client";
import { useFocusLoader } from "@/hooks/use-focus-loader";
import { formatKarachi } from "@/lib/format-date";
import { Spinner } from "@/components/ui/spinner";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { useTranslations } from "@/lib/locale-context";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/config";
import { downloadAndOpenFile } from "@/lib/download-file";
import { interpolate, type MobileDictionary } from "@zindagi/i18n";

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#FFF4E5", fg: "#B45309" },
  confirmed: { bg: colors.brand.muted, fg: colors.brand.mutedForeground },
  in_progress: { bg: colors.brand.muted, fg: colors.brand.mutedForeground },
  completed: { bg: colors.neutral.muted, fg: "#475569" },
  cancelled: { bg: "#FDECEC", fg: "#B91C1C" },
  no_show: { bg: "#FDECEC", fg: "#B91C1C" },
};

export default function AppointmentsScreen() {
  const router = useRouter();
  const t = useTranslations();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AppointmentHistoryItem | null>(null);
  const loadItems = useCallback(() => getAppointmentHistory().then((data) => data ?? []), []);
  const { data: items, error, load } = useFocusLoader(loadItems, t.appointments.loadError);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const onJoin = async (appointmentId: string) => {
    try {
      const payload = await joinVideoSession(appointmentId);
      await Linking.openURL(payload.joinUrl);
    } catch (e) {
      Alert.alert(t.appointments.joinErrorTitle, e instanceof ApiRequestError ? e.message : t.common.tryAgain);
    }
  };

  const onViewPrescription = async (item: AppointmentHistoryItem) => {
    if (!item.prescription) return;
    try {
      await downloadAndOpenFile(item.prescription.downloadUrl, `${item.doctor.name.replace(/\s+/g, "-")}-prescription.pdf`);
    } catch (e) {
      Alert.alert(t.appointments.prescriptionErrorTitle, e instanceof Error ? e.message : t.common.tryAgain);
    }
  };

  if (!items) {
    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        </View>
      );
    }
    return <BrandLoadingScreen />;
  }

  return (
    <>
      {error ? (
        <Text style={styles.refreshError} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <FlatList
        testID="appointments-list"
        style={styles.screen}
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => item.appointmentId}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.hint}>{t.appointments.empty}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <AppointmentCard
            item={item}
            t={t}
            onJoin={onJoin}
            onReview={() => setReviewTarget(item)}
            onViewPrescription={() => onViewPrescription(item)}
            onRequestCancellation={() =>
              router.push({ pathname: "/refund-request", params: { appointmentId: item.appointmentId } })
            }
          />
        )}
      />
      <ReviewModal
        key={reviewTarget?.appointmentId ?? "none"}
        item={reviewTarget}
        t={t}
        onClose={() => setReviewTarget(null)}
        onSubmitted={() => {
          setReviewTarget(null);
          load();
        }}
      />
    </>
  );
}

function AppointmentCard({
  item,
  t,
  onJoin,
  onReview,
  onViewPrescription,
  onRequestCancellation,
}: {
  item: AppointmentHistoryItem;
  t: MobileDictionary;
  onJoin: (id: string) => void;
  onReview: () => void;
  onViewPrescription: () => void;
  onRequestCancellation: () => void;
}) {
  const avatarUri = resolveMediaUrl(item.doctor.avatarUrl);
  const statusStyle = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending;
  const STATUS_LABEL = t.appointments.status as Record<string, string>;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.doctorRow}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{item.doctor.name[0]}</Text>
            </View>
          )}
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName}>{item.doctor.name}</Text>
            <Text style={styles.specialty}>{item.doctor.specialty}</Text>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.fg }]}>
            {STATUS_LABEL[item.status] ?? item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.typeLabel}>{item.typeLabel}</Text>
      <Text style={styles.time}>{formatKarachi(item.scheduledStart)}</Text>

      <View style={styles.actions}>
        {item.canJoin ? (
          <Pressable style={styles.primaryButton} onPress={() => onJoin(item.appointmentId)} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>{t.appointments.joinCall}</Text>
          </Pressable>
        ) : item.prescription ? (
          <Pressable style={styles.secondaryButton} onPress={onViewPrescription} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>{t.appointments.viewPrescription}</Text>
          </Pressable>
        ) : null}

        {item.canReview || item.review ? (
          <Pressable
            style={[styles.secondaryButton, styles.reviewButton]}
            onPress={onReview}
            accessibilityRole="button"
            accessibilityLabel={item.review ? `Your rating: ${item.review.rating} stars` : t.appointments.leaveReview}
          >
            {item.review ? (
              <>
                <Ionicons name="star" size={13} color="#F5A623" />
                <Text style={styles.secondaryButtonText}>{item.review.rating}</Text>
              </>
            ) : (
              <Text style={styles.secondaryButtonText}>{t.appointments.leaveReview}</Text>
            )}
          </Pressable>
        ) : null}

        {item.canRequestCancellation ? (
          <Pressable style={styles.dangerButton} onPress={onRequestCancellation} accessibilityRole="button">
            <Text style={styles.dangerButtonText}>{t.appointments.requestRefund}</Text>
          </Pressable>
        ) : null}
      </View>

      {item.cancellationRequestStatus === "pending" ? (
        <Text style={styles.cancelPendingHint}>{t.appointments.refundPending}</Text>
      ) : null}
    </View>
  );
}

function ReviewModal({
  item,
  t,
  onClose,
  onSubmitted,
}: {
  item: AppointmentHistoryItem | null;
  t: MobileDictionary;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!item) return null;
  const alreadyReviewed = Boolean(item.review);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      await submitAppointmentReview(item.appointmentId, { rating, comment: comment || undefined });
      onSubmitted();
    } catch (e) {
      Alert.alert(t.appointments.reviewErrorTitle, e instanceof ApiRequestError ? e.message : t.common.tryAgain);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{interpolate(t.appointments.rateDoctor, { name: item.doctor.name })}</Text>

          {alreadyReviewed ? (
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= item.review!.rating ? "star" : "star-outline"}
                  size={28}
                  color="#F5A623"
                />
              ))}
              {item.review!.comment ? (
                <Text style={styles.hint}>"{item.review!.comment}"</Text>
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setRating(n)}
                    accessibilityRole="radio"
                    accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
                    accessibilityState={{ checked: n === rating }}
                  >
                    <Ionicons name={n <= rating ? "star" : "star-outline"} size={32} color="#F5A623" />
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.commentInput}
                accessibilityLabel={t.appointments.commentPlaceholder}
                placeholder={t.appointments.commentPlaceholder}
                value={comment}
                onChangeText={setComment}
                multiline
              />
            </>
          )}

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
              <Text style={styles.secondaryButtonText}>{t.common.close}</Text>
            </Pressable>
            {!alreadyReviewed && (
              <Pressable
                style={styles.primaryButton}
                onPress={submit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={t.appointments.submit}
                accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
              >
                {isSubmitting ? (
                  <Spinner size="sm" color={colors.brand.foreground} />
                ) : (
                  <Text style={styles.primaryButtonText}>{t.appointments.submit}</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  list: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.medium },
  refreshError: { color: "#c62828", fontFamily: fonts.medium, fontSize: 12, textAlign: "center", paddingVertical: 6, backgroundColor: colors.neutral.background },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 4,
    backgroundColor: colors.neutral.background,
    ...cardShadow,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  doctorRow: { flexDirection: "row", gap: 10, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.neutral.muted },
  avatarPlaceholder: { backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.bold, color: colors.brand.mutedForeground, fontSize: 16 },
  doctorInfo: { flex: 1, gap: 1 },
  doctorName: { fontSize: 15, fontFamily: fonts.bold, color: colors.neutral.foreground },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontFamily: fonts.semibold },
  specialty: { color: "#666", fontSize: 13, fontFamily: fonts.regular },
  typeLabel: { color: colors.accent.DEFAULT, fontSize: 13, fontFamily: fonts.medium, marginTop: 8 },
  time: { color: "#333", fontSize: 13, marginTop: 2, fontFamily: fonts.regular },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  primaryButton: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold },
  secondaryButton: {
    backgroundColor: colors.neutral.muted,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.neutral.foreground, fontFamily: fonts.semibold },
  reviewButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  dangerButton: {
    backgroundColor: "#FDECEC",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  dangerButtonText: { color: "#B91C1C", fontFamily: fonts.semibold },
  cancelPendingHint: { marginTop: 8, color: "#B45309", fontSize: 12, fontFamily: fonts.medium },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.neutral.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.neutral.foreground },
  stars: { flexDirection: "row", gap: 8 },
  star: { fontSize: 32, color: "#ccc" },
  starActive: { color: colors.accent.DEFAULT },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontFamily: fonts.regular,
  },
  modalActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
});
