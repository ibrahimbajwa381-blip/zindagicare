import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listConsultDoctors, type ConsultDoctorRow } from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/config";

export default function DoctorsScreen() {
  const router = useRouter();
  const [city, setCity] = useState("Lahore");
  const [specialty, setSpecialty] = useState("");
  const [doctors, setDoctors] = useState<ConsultDoctorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (opts: { city: string; specialty: string }) => {
    try {
      const data = await listConsultDoctors({
        city: opts.city || undefined,
        specialty: opts.specialty || undefined,
      });
      setDoctors(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load doctors");
    }
  }, []);

  useEffect(() => {
    load({ city, specialty });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          placeholder="City"
          placeholderTextColor="#9AA5B1"
          onSubmitEditing={() => load({ city, specialty })}
        />
        <TextInput
          style={styles.input}
          value={specialty}
          onChangeText={setSpecialty}
          placeholder="Specialty"
          placeholderTextColor="#9AA5B1"
          onSubmitEditing={() => load({ city, specialty })}
        />
        <Pressable style={styles.searchButton} onPress={() => load({ city, specialty })}>
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>

      {!doctors ? (
        <View style={styles.centered}>
          {error ? <Text style={styles.error}>{error}</Text> : <Spinner />}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={doctors}
          keyExtractor={(d) => d.doctorId}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.hint}>No doctors found for this search.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const avatarUri = resolveMediaUrl(item.avatarUrl);
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed, item.isFull && styles.cardDisabled]}
                onPress={() => router.push({ pathname: "/doctor/[doctorId]", params: { doctorId: item.doctorId } })}
                disabled={item.isFull}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{item.name[0]}</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.pmdcVerified ? (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.brand.mutedForeground} />
                        <Text style={styles.verifiedBadgeText}>PMDC</Text>
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
                  <View style={styles.metaRow}>
                    <Ionicons name="star" size={13} color="#F5A623" />
                    <Text style={styles.rating}>{item.ratingAvg.toFixed(1)}</Text>
                    <Text style={styles.ratingCount}>({item.ratingCount})</Text>
                    <View style={styles.feePill}>
                      <Text style={styles.feePillText}>Rs. {item.consultationFee}</Text>
                    </View>
                  </View>
                  {item.isFull ? (
                    <Text style={styles.full}>No slots available</Text>
                  ) : (
                    <Text style={styles.available}>{item.availableSlots} slots this week</Text>
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
