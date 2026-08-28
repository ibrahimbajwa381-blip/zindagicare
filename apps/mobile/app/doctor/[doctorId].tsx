import { useEffect, useMemo, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { listConsultSlots, type ConsultSlot } from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";

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

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DoctorSlotsScreen() {
  const { doctorId } = useLocalSearchParams<{ doctorId: string }>();
  const router = useRouter();
  const [slots, setSlots] = useState<ConsultSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listConsultSlots(doctorId)
      .then((res) => setSlots(res.slots))
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "Failed to load slots"));
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

  if (!slots) {
    return (
      <>
        <Stack.Screen options={{ title: "Select a time" }} />
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

  return (
    <>
      <Stack.Screen options={{ title: "Select a time" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {grouped.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.hint}>No available slots in the next two weeks.</Text>
          </View>
        ) : (
          grouped.map(([key, daySlots]) => (
            <View key={key} style={styles.day}>
              <Text style={styles.dayLabel}>{dayLabel(daySlots[0].startAt)}</Text>
              <View style={styles.slotRow}>
                {daySlots.map((slot) => (
                  <Pressable
                    key={slot.slotId}
                    style={({ pressed }) => [styles.slotChip, pressed && styles.slotChipPressed]}
                    onPress={() =>
                      router.push({
                        pathname: "/checkout",
                        params: { doctorId, slotId: slot.slotId, startAt: slot.startAt },
                      })
                    }
                  >
                    {({ pressed }) => (
                      <Text style={[styles.slotText, pressed && styles.slotTextPressed]}>
                        {timeLabel(slot.startAt)}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },
  day: {
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    ...cardShadow,
  },
  dayLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.neutral.foreground },
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
});
