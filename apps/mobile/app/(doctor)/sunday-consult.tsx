import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getDoctorProfile,
  getSundayDoctorQueue,
  toggleSundayConsult,
  updateSundayAppointmentStatus,
  upsertSundayTemplate,
  type DoctorProfileDto,
  type SundayDoctorQueue,
} from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";

const STATUS_ACTIONS: { key: "completed" | "no_show" | "cancelled"; label: string; color: string }[] = [
  { key: "completed", label: "Completed", color: "#16a34a" },
  { key: "no_show", label: "No-show", color: "#F5A623" },
  { key: "cancelled", label: "Cancel", color: "#c62828" },
];

const POLL_MS = 15_000;

export default function DoctorSundayConsultScreen() {
  const [profile, setProfile] = useState<DoctorProfileDto | null>(null);
  const [queue, setQueue] = useState<SundayDoctorQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [template, setTemplate] = useState({
    startTimeLocal: "10:00",
    endTimeLocal: "13:00",
    slotDurationMins: "10",
    maxSlots: "15",
  });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedTemplate = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const [profileRes, queueRes] = await Promise.all([getDoctorProfile(), getSundayDoctorQueue()]);
      setProfile(profileRes);
      setQueue(queueRes);
      // Only seed the editable form from the server once — a background poll shouldn't
      // clobber a schedule edit the doctor is mid-typing.
      if (!hasLoadedTemplate.current && profileRes.sundayConsult.startTimeLocal) {
        setTemplate({
          startTimeLocal: profileRes.sundayConsult.startTimeLocal,
          endTimeLocal: profileRes.sundayConsult.endTimeLocal ?? "13:00",
          slotDurationMins: String(profileRes.sundayConsult.slotDurationMins ?? 10),
          maxSlots: String(profileRes.sundayConsult.maxSlots ?? 15),
        });
        hasLoadedTemplate.current = true;
      }
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof ApiRequestError ? e.message : "Failed to load Sunday consult");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      pollRef.current = setInterval(() => load(true), POLL_MS);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const onToggle = async (value: boolean) => {
    setIsTogglingEnabled(true);
    try {
      await toggleSundayConsult(value);
      await load();
    } catch (e) {
      Alert.alert("Couldn't update", e instanceof ApiRequestError ? e.message : "Please try again");
    } finally {
      setIsTogglingEnabled(false);
    }
  };

  const saveTemplate = async () => {
    const slotDurationMins = Number(template.slotDurationMins);
    const maxSlots = Number(template.maxSlots);
    if (!Number.isFinite(slotDurationMins) || slotDurationMins < 5) {
      Alert.alert("Invalid duration", "Slot duration must be at least 5 minutes.");
      return;
    }
    if (!Number.isFinite(maxSlots) || maxSlots < 1) {
      Alert.alert("Invalid slots", "Max slots must be at least 1.");
      return;
    }
    setIsSavingTemplate(true);
    try {
      await upsertSundayTemplate({
        startTimeLocal: template.startTimeLocal,
        endTimeLocal: template.endTimeLocal,
        slotDurationMins,
        maxSlots,
        isActive: true,
      });
      await load();
      Alert.alert("Saved", "Your Sunday consult schedule has been updated.");
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof ApiRequestError ? e.message : "Please try again");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const setStatus = (appointmentId: string, status: "completed" | "no_show" | "cancelled") => {
    setUpdatingId(appointmentId);
    updateSundayAppointmentStatus(appointmentId, status)
      .then(() => load())
      .catch((e) => Alert.alert("Couldn't update", e instanceof ApiRequestError ? e.message : "Please try again"))
      .finally(() => setUpdatingId(null));
  };

  if (!profile || !queue) {
    return error ? (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    ) : (
      <BrandLoadingScreen />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Sunday free consult</Text>
            <Text style={styles.subLabel}>Offer free consultations on Sundays</Text>
          </View>
          {isTogglingEnabled ? (
            <Spinner size="sm" />
          ) : (
            <Switch
              value={profile.sundayConsult.enabled}
              onValueChange={onToggle}
              trackColor={{ true: colors.brand.DEFAULT }}
            />
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Start (HH:mm)</Text>
            <TextInput
              style={styles.input}
              value={template.startTimeLocal}
              onChangeText={(v) => setTemplate({ ...template, startTimeLocal: v })}
              placeholder="10:00"
              placeholderTextColor="#9AA5B1"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>End (HH:mm)</Text>
            <TextInput
              style={styles.input}
              value={template.endTimeLocal}
              onChangeText={(v) => setTemplate({ ...template, endTimeLocal: v })}
              placeholder="13:00"
              placeholderTextColor="#9AA5B1"
            />
          </View>
        </View>
        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Slot duration (mins)</Text>
            <TextInput
              style={styles.input}
              value={template.slotDurationMins}
              onChangeText={(v) => setTemplate({ ...template, slotDurationMins: v.replace(/[^0-9]/g, "") })}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Max slots</Text>
            <TextInput
              style={styles.input}
              value={template.maxSlots}
              onChangeText={(v) => setTemplate({ ...template, maxSlots: v.replace(/[^0-9]/g, "") })}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <Pressable style={styles.saveButton} onPress={saveTemplate} disabled={isSavingTemplate}>
          {isSavingTemplate ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.saveButtonText}>Save schedule</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>This Sunday's queue</Text>
        {queue.appointments.length === 0 ? (
          <Text style={styles.hint}>No bookings for this Sunday yet.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {queue.appointments.map((apt) => (
              <View key={apt._id} style={styles.aptRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aptName}>{apt.patientId?.name ?? "Patient"}</Text>
                  <Text style={styles.aptMeta}>{formatKarachi(apt.scheduledStart)}</Text>
                  {apt.patientNotes ? (
                    <Text style={styles.aptNotes} numberOfLines={2}>
                      “{apt.patientNotes}”
                    </Text>
                  ) : null}
                  <Text style={styles.aptStatus}>{apt.status.replace("_", " ")}</Text>
                </View>
                {apt.status === "confirmed" || apt.status === "pending" || apt.status === "in_progress" ? (
                  <View style={styles.actionCol}>
                    {STATUS_ACTIONS.map((action) => (
                      <Pressable
                        key={action.key}
                        style={[styles.statusButton, { borderColor: action.color }]}
                        onPress={() => setStatus(apt._id, action.key)}
                        disabled={updatingId === apt._id}
                      >
                        <Text style={[styles.statusButtonText, { color: action.color }]}>{action.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
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
  hint: { color: "#666", fontFamily: fonts.regular, fontSize: 13 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12, ...cardShadow },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  subLabel: { fontFamily: fonts.regular, fontSize: 12, color: "#999", marginTop: 2 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  label: { fontFamily: fonts.medium, fontSize: 12, color: "#666", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: 10,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },
  timeRow: { flexDirection: "row", gap: 12 },
  saveButton: { backgroundColor: colors.brand.DEFAULT, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  saveButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 14 },

  aptRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  aptName: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.neutral.foreground },
  aptMeta: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },
  aptNotes: { fontFamily: fonts.regular, fontSize: 12, color: "#555", fontStyle: "italic", marginTop: 2 },
  aptStatus: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.brand.mutedForeground,
    textTransform: "capitalize",
    marginTop: 2,
  },
  actionCol: { gap: 6 },
  statusButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusButtonText: { fontFamily: fonts.semibold, fontSize: 11 },
});
