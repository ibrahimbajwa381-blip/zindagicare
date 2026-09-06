import { useRef, useState } from "react";
import { Redirect, Stack, useRouter } from "expo-router";
import * as Location from "expo-location";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { HOME_CARE_MVP_SERVICES, HOME_CARE_PRICING } from "@zindagi/shared/constants/home-care";
import { createHomeVisit, type HomeCareServiceType } from "@/api/home-visits";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";

const SERVICE_LABELS: Record<string, string> = {
  doctor_visit: "Doctor visit",
  nurse: "Nurse care",
  physiotherapy: "Physiotherapy",
  iv_drip: "IV drip",
  injection: "Injection",
  wound_care: "Wound care",
};

function toLocalDatetimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function HomeVisitRequestScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [serviceType, setServiceType] = useState<HomeCareServiceType>(HOME_CARE_MVP_SERVICES[0]);
  const [addressLine, setAddressLine] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 90 * 60 * 1000);
    return toLocalDatetimeInput(d);
  });
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const useCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow location access to auto-fill your coordinates.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert("Couldn't get location", "Please enable location services and try again.");
    } finally {
      setIsLocating(false);
    }
  };

  const submit = async () => {
    if (isSubmittingRef.current) return;
    if (addressLine.trim().length < 5) {
      setError("Enter a fuller address (at least 5 characters).");
      return;
    }
    if (!geo) {
      setError("Set your location so the visiting staff can find you.");
      return;
    }
    // "YYYY-MM-DD HH:MM" (local, no timezone) -> Date -> ISO.
    const parsedDate = new Date(scheduledAt.replace(" ", "T"));
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() < Date.now() + 55 * 60 * 1000) {
      setError("Pick a time at least an hour from now, as YYYY-MM-DD HH:MM.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await createHomeVisit({
        serviceType,
        addressLine,
        geo,
        scheduledAt: parsedDate.toISOString(),
        patientNotes: notes || undefined,
      });
      router.replace("/home-visit");
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't submit request. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return <BrandLoadingScreen />;
  }
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: "Request a home visit" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Service</Text>
          <View style={styles.serviceGrid}>
            {HOME_CARE_MVP_SERVICES.map((type: HomeCareServiceType) => (
              <Pressable
                key={type}
                style={[styles.serviceChip, serviceType === type && styles.serviceChipActive]}
                onPress={() => setServiceType(type)}
                accessibilityRole="button"
                accessibilityState={{ selected: serviceType === type }}
              >
                <Text style={[styles.serviceChipText, serviceType === type && styles.serviceChipTextActive]}>
                  {SERVICE_LABELS[type]}
                </Text>
                <Text style={[styles.servicePrice, serviceType === type && styles.serviceChipTextActive]}>
                  Rs. {HOME_CARE_PRICING[type as keyof typeof HOME_CARE_PRICING]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={addressLine}
            onChangeText={setAddressLine}
            placeholder="House/street, area, landmark"
            placeholderTextColor="#9AA5B1"
            multiline
            accessibilityLabel="Address"
          />

          <Pressable style={styles.secondaryButton} onPress={useCurrentLocation} disabled={isLocating} accessibilityRole="button">
            {isLocating ? (
              <Spinner size="sm" />
            ) : (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color={colors.neutral.foreground} />
                <Text style={styles.secondaryButtonText}>
                  {geo ? `Location set (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})` : "Use my current location"}
                </Text>
              </View>
            )}
          </Pressable>

          <Text style={styles.label}>Preferred date & time (YYYY-MM-DD HH:MM)</Text>
          <TextInput
            style={styles.input}
            value={scheduledAt}
            onChangeText={setScheduledAt}
            placeholderTextColor="#9AA5B1"
            accessibilityLabel="Preferred date & time (YYYY-MM-DD HH:MM)"
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Anything the visiting staff should know"
            placeholderTextColor="#9AA5B1"
            accessibilityLabel="Notes (optional)"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={submit} disabled={isSubmitting} accessibilityRole="button">
          {isSubmitting ? (
            <Spinner size="sm" color={colors.brand.foreground} />
          ) : (
            <Text style={styles.primaryButtonText}>Request visit</Text>
          )}
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    ...cardShadow,
  },
  label: { fontFamily: fonts.medium, fontSize: 13, color: "#666", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  serviceChip: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: "30%",
  },
  serviceChipActive: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.brand.muted },
  serviceChipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.neutral.foreground },
  serviceChipTextActive: { color: colors.brand.mutedForeground },
  servicePrice: { fontFamily: fonts.regular, fontSize: 12, color: "#888", marginTop: 2 },
  secondaryButton: {
    backgroundColor: colors.neutral.muted,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryButtonText: { color: colors.neutral.foreground, fontFamily: fonts.medium, fontSize: 14 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  error: { color: "#c62828", fontFamily: fonts.regular, marginTop: 8 },
  primaryButton: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
});
