import { useCallback, useMemo, useRef, useState } from "react";
import { Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import {
  getAppointmentHistory,
  requestAppointmentCancellation,
  type AppointmentHistoryItem,
  type RefundMethod,
} from "@/api/appointments";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { formatKarachi } from "@/lib/format-date";
import { Spinner } from "@/components/ui/spinner";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";

const METHODS: { value: RefundMethod; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { value: "jazzcash", label: "JazzCash", icon: "phone-portrait-outline", hint: "Mobile wallet" },
  { value: "easypaisa", label: "Easypaisa", icon: "wallet-outline", hint: "Mobile wallet" },
  { value: "bank", label: "Bank", icon: "business-outline", hint: "Bank transfer" },
];

export default function RefundRequestScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { appointmentId: paramAppointmentId } = useLocalSearchParams<{ appointmentId?: string }>();

  const [items, setItems] = useState<AppointmentHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(paramAppointmentId ?? null);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<RefundMethod>("jazzcash");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const isSubmittingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await getAppointmentHistory();
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load appointments");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const eligible = useMemo(() => (items ?? []).filter((i) => i.canRequestCancellation), [items]);

  const selected = eligible.find((i) => i.appointmentId === appointmentId) ?? eligible[0] ?? null;
  const effectiveId = selected?.appointmentId ?? null;

  const canSubmit =
    Boolean(effectiveId) &&
    reason.trim().length >= 3 &&
    accountTitle.trim().length >= 2 &&
    accountNumber.trim().length >= 5 &&
    (method !== "bank" || bankName.trim().length >= 2);

  const submit = async () => {
    if (!effectiveId || !canSubmit || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await requestAppointmentCancellation(effectiveId, {
        reason: reason.trim(),
        refundMethod: method,
        refundAccountTitle: accountTitle.trim(),
        refundAccountNumber: accountNumber.trim(),
        ...(method === "bank" ? { refundBankName: bankName.trim() } : {}),
      });
      setSuccess(true);
    } catch (e) {
      Alert.alert(
        "Couldn't submit request",
        e instanceof ApiRequestError ? e.message : "Please try again",
      );
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

  if (!items) {
    if (error) {
      return (
        <View style={styles.centered}>
          <Stack.Screen options={{ title: "Request a refund" }} />
          <Text style={styles.error}>{error}</Text>
        </View>
      );
    }
    return <BrandLoadingScreen />;
  }

  if (success) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "Request a refund" }} />
        <Ionicons name="checkmark-circle" size={56} color={colors.brand.DEFAULT} />
        <Text style={styles.successTitle}>Refund request submitted</Text>
        <Text style={styles.hint}>
          We've cancelled your appointment and sent your refund request to our team. Your money
          will be transferred to the account you provided within 3–5 business days.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace("/(tabs)/appointments")} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Back to appointments</Text>
        </Pressable>
      </View>
    );
  }

  if (eligible.length === 0) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "Request a refund" }} />
        <Text style={styles.hint}>
          You don't have any upcoming appointments eligible for a refund right now.
        </Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Request a refund" }} />

      <Text style={styles.sectionLabel}>Which appointment?</Text>
      <View style={{ gap: 8 }}>
        {eligible.map((item) => (
          <Pressable
            key={item.appointmentId}
            style={[styles.appointmentRow, item.appointmentId === effectiveId && styles.appointmentRowActive]}
            onPress={() => setAppointmentId(item.appointmentId)}
            accessibilityRole="button"
            accessibilityState={{ selected: item.appointmentId === effectiveId }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorName}>{item.doctor.name}</Text>
              <Text style={styles.meta}>
                {item.typeLabel} · {formatKarachi(item.scheduledStart)}
              </Text>
            </View>
            <Ionicons
              name={item.appointmentId === effectiveId ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={item.appointmentId === effectiveId ? colors.brand.DEFAULT : "#ccc"}
            />
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Why are you cancelling?</Text>
      <TextInput
        style={styles.textArea}
        placeholder="e.g. I no longer need this consultation…"
        value={reason}
        onChangeText={setReason}
        multiline
        accessibilityLabel="Why are you cancelling?"
      />

      <Text style={styles.sectionLabel}>How should we send your refund?</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <Pressable
            key={m.value}
            style={[styles.methodCard, method === m.value && styles.methodCardActive]}
            onPress={() => setMethod(m.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: method === m.value }}
          >
            <Ionicons name={m.icon} size={20} color={method === m.value ? colors.brand.DEFAULT : "#999"} />
            <Text style={[styles.methodLabel, method === m.value && styles.methodLabelActive]}>{m.label}</Text>
            <Text style={styles.methodHint}>{m.hint}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Account holder name</Text>
      <TextInput
        style={styles.input}
        placeholder="As it appears on the account"
        value={accountTitle}
        onChangeText={setAccountTitle}
        accessibilityLabel="Account holder name"
      />

      <Text style={styles.sectionLabel}>{method === "bank" ? "Account number / IBAN" : "Mobile number"}</Text>
      <TextInput
        style={styles.input}
        placeholder={method === "bank" ? "PKxx BANK 0000 1234 5678" : "03xx xxxxxxx"}
        value={accountNumber}
        onChangeText={setAccountNumber}
        keyboardType={method === "bank" ? "default" : "phone-pad"}
        accessibilityLabel={method === "bank" ? "Account number / IBAN" : "Mobile number"}
      />

      {method === "bank" ? (
        <>
          <Text style={styles.sectionLabel}>Bank name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. HBL, Meezan Bank"
            value={bankName}
            onChangeText={setBankName}
            accessibilityLabel="Bank name"
          />
        </>
      ) : null}

      <Pressable
        style={[styles.primaryButton, { marginTop: 24 }, (!canSubmit || isSubmitting) && styles.buttonDisabled]}
        onPress={submit}
        disabled={!canSubmit || isSubmitting}
        accessibilityRole="button"
      >
        {isSubmitting ? (
          <Spinner size="sm" color={colors.brand.foreground} />
        ) : (
          <Text style={styles.primaryButtonText}>Submit refund request</Text>
        )}
      </Pressable>
      <Text style={styles.footnote}>
        We'll review your request and send the money manually — no gateway fees.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 20, paddingBottom: 40, gap: 8 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  hint: { color: "#666", fontFamily: fonts.regular, textAlign: "center", lineHeight: 20 },
  error: { color: "#c62828", fontFamily: fonts.medium },
  successTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.neutral.foreground, marginTop: 4 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.neutral.foreground, marginTop: 16, marginBottom: 4 },
  appointmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "transparent",
    ...cardShadow,
  },
  appointmentRowActive: { borderColor: colors.brand.DEFAULT },
  doctorName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.neutral.foreground },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: "#666", marginTop: 2 },
  textArea: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontFamily: fonts.regular,
    backgroundColor: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 12,
    padding: 12,
    fontFamily: fonts.regular,
    backgroundColor: "#fff",
  },
  methodRow: { flexDirection: "row", gap: 8 },
  methodCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  methodCardActive: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.brand.muted },
  methodLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.neutral.foreground },
  methodLabelActive: { color: colors.brand.mutedForeground },
  methodHint: { fontFamily: fonts.regular, fontSize: 10, color: "#999" },
  primaryButton: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
  secondaryButton: {
    backgroundColor: colors.brand.muted,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.brand.mutedForeground, fontFamily: fonts.semibold },
  footnote: { marginTop: 10, textAlign: "center", fontSize: 11, color: "#999", fontFamily: fonts.regular },
});
