import { useRef, useState } from "react";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { cancelHomeVisit, type HomeVisitRefundMethod } from "@/api/home-visits";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";

const METHODS: { value: HomeVisitRefundMethod; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { value: "jazzcash", label: "JazzCash", icon: "phone-portrait-outline", hint: "Mobile wallet" },
  { value: "easypaisa", label: "Easypaisa", icon: "wallet-outline", hint: "Mobile wallet" },
  { value: "bank", label: "Bank", icon: "business-outline", hint: "Bank transfer" },
];

export default function HomeVisitCancelRefundScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { visitId } = useLocalSearchParams<{ visitId: string }>();

  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<HomeVisitRefundMethod>("jazzcash");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const isSubmittingRef = useRef(false);

  const canSubmit =
    reason.trim().length >= 3 &&
    accountTitle.trim().length >= 2 &&
    accountNumber.trim().length >= 5 &&
    (method !== "bank" || bankName.trim().length >= 2);

  const submit = async () => {
    if (!canSubmit || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await cancelHomeVisit(visitId, {
        cancellationReason: reason.trim(),
        refundMethod: method,
        refundAccountTitle: accountTitle.trim(),
        refundAccountNumber: accountNumber.trim(),
        ...(method === "bank" ? { refundBankName: bankName.trim() } : {}),
      });
      setSuccess(true);
    } catch (e) {
      Alert.alert("Couldn't submit request", e instanceof ApiRequestError ? e.message : "Please try again");
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

  if (success) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "Cancel & refund" }} />
        <View style={styles.successBadge}>
          <Ionicons name="checkmark" size={40} color={colors.brand.DEFAULT} />
        </View>
        <Text style={styles.successTitle}>Visit cancelled</Text>
        <Text style={styles.hint}>
          Your home visit has been cancelled. Our team will review your refund request and send
          the money manually to the account you provided within 3–5 business days.
        </Text>
        <Pressable
          style={[styles.primaryButton, styles.successButton]}
          onPress={() => router.replace("/home-visit")}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Back to home visits</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Cancel & refund" }} />

      <Text style={styles.hint}>
        This visit has already been paid for. Cancelling it will mark the visit cancelled right
        away and send a refund request to our team.
      </Text>

      <Text style={styles.sectionLabel}>Why are you cancelling?</Text>
      <TextInput
        style={styles.textArea}
        placeholder="e.g. I no longer need this visit…"
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
  hint: { color: "#666", fontFamily: fonts.regular, textAlign: "center", lineHeight: 21 },
  successBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  successTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.neutral.foreground, letterSpacing: -0.2 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.neutral.foreground, marginTop: 16, marginBottom: 4 },
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
  successButton: { paddingHorizontal: 32, minWidth: 220, marginTop: 20, ...cardShadow },
  primaryButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
  footnote: { marginTop: 10, textAlign: "center", fontSize: 11, color: "#999", fontFamily: fonts.regular },
});
