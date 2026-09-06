import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { listConsultDoctors, type ConsultDoctorRow } from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { Spinner } from "@/components/ui/spinner";
import { useLocale } from "@/lib/locale-context";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/config";
import { interpolate } from "@zindagi/i18n";

export default function DoctorsScreen() {
  const router = useRouter();
  const { t, isRTL } = useLocale();
  const [city, setCity] = useState("Lahore");
  const [specialty, setSpecialty] = useState("");
  const [doctors, setDoctors] = useState<ConsultDoctorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const latestRequestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  const load = useCallback(async (opts: { city: string; specialty: string }) => {
    const requestId = ++latestRequestIdRef.current;
    try {
      const data = await listConsultDoctors({
        city: opts.city || undefined,
        specialty: opts.specialty || undefined,
      });
      if (requestId !== latestRequestIdRef.current) return; // a newer load() already landed
      setDoctors(data ?? []);
      setError(null);
    } catch (e) {
      if (requestId !== latestRequestIdRef.current) return;
      setError(e instanceof ApiRequestError ? e.message : t.doctors.loadError);
    } finally {
      if (requestId === latestRequestIdRef.current) setIsSearching(false);
    }
  }, [t]);

  useEffect(() => {
    load({ city, specialty });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live search: re-run automatically as the user types, instead of requiring
  // a tap on Search — debounced so it doesn't fire a request per keystroke.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    setIsSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load({ city, specialty });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [city, specialty, load]);

  const searchNow = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSearching(true);
    load({ city, specialty });
  }, [city, specialty, load]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load({ city, specialty });
    setIsRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder={t.doctors.cityPlaceholder}
          placeholderTextColor="#9AA5B1"
          onSubmitEditing={searchNow}
          accessibilityLabel={t.doctors.cityPlaceholder}
        />
        <TextInput
          style={styles.input}
          value={specialty}
          onChangeText={setSpecialty}
          placeholder={t.doctors.specialtyPlaceholder}
          placeholderTextColor="#9AA5B1"
          onSubmitEditing={searchNow}
          accessibilityLabel={t.doctors.specialtyPlaceholder}
        />
        <Pressable
          style={styles.searchButton}
          onPress={searchNow}
          accessibilityRole="button"
          accessibilityLabel={t.doctors.search}
        >
          {isSearching ? (
            <Spinner size="sm" color={colors.brand.foreground} />
          ) : (
            <Text style={styles.searchButtonText}>{t.doctors.search}</Text>
          )}
        </Pressable>
      </View>

      {!doctors ? (
        <View style={styles.centered}>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : (
            <Spinner />
          )}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={doctors}
          keyExtractor={(d) => d.doctorId}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={error ? <Text style={styles.refreshError}>{error}</Text> : null}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.hint}>{t.doctors.empty}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const avatarUri = resolveMediaUrl(item.avatarUrl);
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  isRTL && styles.cardRtl,
                  pressed && styles.cardPressed,
                  item.isFull && styles.cardDisabled,
                ]}
                onPress={() => router.push({ pathname: "/doctor/[doctorId]", params: { doctorId: item.doctorId } })}
                disabled={item.isFull}
                accessibilityRole="button"
                accessibilityState={{ disabled: item.isFull }}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{item.name[0]}</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={[styles.nameRow, isRTL && styles.rowRtl]}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.pmdcVerified ? (
                      <View style={[styles.verifiedBadge, isRTL && styles.rowRtl]}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.brand.mutedForeground} />
                        <Text style={styles.verifiedBadgeText}>{t.doctors.verifiedBadge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.specialty} numberOfLines={1}>
                    {item.specialties.join(", ")}
                  </Text>
                  {item.hospital ? (
                    <Text style={styles.hospital} numberOfLines={1}>
                      {item.hospital}
                    </Text>
                  ) : null}
                  <View style={[styles.metaRow, isRTL && styles.rowRtl]}>
                    <Ionicons name="star" size={13} color="#F5A623" />
                    <Text style={styles.rating}>{item.ratingAvg.toFixed(1)}</Text>
                    <Text style={styles.ratingCount}>({item.ratingCount})</Text>
                    <View style={styles.feePill}>
                      <Text style={styles.feePillText}>{interpolate(t.doctors.fee, { amount: item.consultationFee })}</Text>
                    </View>
                  </View>
                  {item.isFull ? (
                    <Text style={styles.full}>{t.doctors.noSlots}</Text>
                  ) : (
                    <Text style={styles.available}>{interpolate(t.doctors.slotsAvailable, { count: item.availableSlots })}</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  filters: { flexDirection: "row", gap: 8, padding: 16, backgroundColor: colors.neutral.background },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
    backgroundColor: colors.neutral.background,
  },
  searchButton: {
    backgroundColor: colors.brand.DEFAULT,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 13 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },
  refreshError: { color: "#c62828", fontFamily: fonts.regular, fontSize: 12, textAlign: "center", paddingVertical: 6, backgroundColor: colors.neutral.background },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#fff",
    ...cardShadow,
  },
  cardPressed: { opacity: 0.85 },
  cardDisabled: { opacity: 0.55 },
  cardRtl: { flexDirection: "row-reverse" },
  rowRtl: { flexDirection: "row-reverse" },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.neutral.muted },
  avatarPlaceholder: { backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.bold, color: colors.brand.mutedForeground, fontSize: 26 },
  cardBody: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.neutral.foreground, flexShrink: 1 },
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
  specialty: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent.DEFAULT },
  hospital: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  rating: { fontFamily: fonts.semibold, fontSize: 13, color: "#F5A623" },
  ratingCount: { fontFamily: fonts.regular, fontSize: 12, color: "#999", marginRight: 6 },
  feePill: {
    backgroundColor: colors.neutral.muted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  feePillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.neutral.foreground },
  available: { fontFamily: fonts.medium, fontSize: 12, color: colors.brand.mutedForeground, marginTop: 4 },
  full: { fontFamily: fonts.medium, fontSize: 12, color: "#c62828", marginTop: 4 },
});
