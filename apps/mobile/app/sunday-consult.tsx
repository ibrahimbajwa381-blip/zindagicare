import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, Stack, useFocusEffect, useRouter } from "expo-router";
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  getMySundayRequest,
  submitSundayRequest,
  SUNDAY_CONTRIBUTION_FEE_PKR,
  SUNDAY_MATCH_WITHIN_MINUTES,
  type SundayAffordabilityChoice,
  type SundayPatientRequestDto,
} from "@/api/sunday";
import { getPaymentStatus, uploadPaymentReceipt, completeTestPayment } from "@/api/consult";
import { getPatientProfile } from "@/api/patient-profile";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";
import { resolveMediaUrl } from "@/lib/config";

/** Mirrors PAID_ONLINE_INTAKE_QUESTION_KEYS / getPaidOnlineIntakeQuestions in @zindagi/shared. */
const HISTORY_QUESTIONS = [
  { key: "chief_complaint", text: "What is the main health concern you would like to discuss with the doctor?" },
  { key: "current_medications", text: "Are you currently taking any medicines, supplements, or home remedies? If yes, please list them." },
  { key: "allergies", text: "Do you have any allergies (medicines, foods, or anything else)? If yes, please describe." },
  { key: "chronic_conditions", text: "Do you have any ongoing medical conditions (e.g. diabetes, blood pressure, asthma, heart disease)?" },
  { key: "additional_info", text: "Is there anything else you would like the doctor to know before your consultation?" },
] as const;

const POLL_MS = 15000;

type PendingCheckout = {
  paymentId: string;
  amount: number;
  manualTransfer?: {
    provider: string;
    account: { number: string; numberDisplay?: string; accountTitle: string };
    description?: string;
  };
};

export default function SundayConsultScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<SundayPatientRequestDto | null>(null);
  const [checkout, setCheckout] = useState<PendingCheckout | null>(null);

  const [phone, setPhone] = useState("");
  const [history, setHistory] = useState<Record<string, string>>({});
  const [affordability, setAffordability] = useState<SundayAffordabilityChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSubmittingRef = useRef(false);
  const isCheckingStatusRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [req, profile] = await Promise.allSettled([getMySundayRequest(), getPatientProfile()]);
      if (req.status === "fulfilled") setRequest(req.value);
      if (profile.status === "fulfilled" && profile.value.user.phone) {
        setPhone((prev) => prev || profile.value.user.phone!);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (request?.status !== "requested") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const next = await getMySundayRequest();
        setRequest(next);
      } catch {
        // Keep polling silently — a transient network error shouldn't stop the flow.
      }
    }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [request?.status]);

  const submit = async () => {
    if (isSubmittingRef.current) return;
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError("Enter a phone number so we can reach you.");
      return;
    }
    if (HISTORY_QUESTIONS.some((q) => !(history[q.key] ?? "").trim())) {
      setError('Please answer every medical history question (write "None" if it does not apply).');
      return;
    }
    if (!affordability) {
      setError("Choose whether you can contribute a small fee.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitSundayRequest({
        patientPhone: trimmedPhone,
        history: HISTORY_QUESTIONS.map((q) => ({ key: q.key, answer: (history[q.key] ?? "").trim() })),
        locale: "en",
        affordabilityChoice: affordability,
      });

      if (result.kind === "payment") {
        setCheckout({
          paymentId: result.paymentId,
          amount: result.amount,
          manualTransfer: result.manualTransfer,
        });
        return;
      }

      setRequest(result);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't submit your request. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const pickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to attach your receipt.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!picked.canceled && picked.assets[0]) {
      setReceiptUri(picked.assets[0].uri);
    }
  };

  const submitReceipt = async () => {
    if (!checkout || !receiptUri) return;
    setIsUploading(true);
    try {
      await uploadPaymentReceipt(
        checkout.paymentId,
        { uri: receiptUri, name: "receipt.jpg", type: "image/jpeg" },
        transactionId || undefined,
      );
      setCheckout(null);
      await load();
    } catch (e) {
      Alert.alert("Couldn't submit receipt", e instanceof Error ? e.message : "Please try again");
    } finally {
      setIsUploading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!checkout || isCheckingStatusRef.current) return;
    isCheckingStatusRef.current = true;
    try {
      const status = await getPaymentStatus(checkout.paymentId);
      if (status.status === "paid") {
        setCheckout(null);
        await load();
      } else {
        Alert.alert("Still pending", "We haven't confirmed your payment yet.");
      }
    } catch (e) {
      Alert.alert("Couldn't check status", e instanceof ApiRequestError ? e.message : "Please try again");
    } finally {
      isCheckingStatusRef.current = false;
    }
  };

  if (loading || isAuthLoading) {
    return <BrandLoadingScreen />;
  }
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: "Sunday Free Consult" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {checkout ? (
          <View style={styles.card}>
            <Text style={styles.label}>Amount due</Text>
            <Text style={styles.amount}>Rs. {checkout.amount}</Text>

            {checkout.manualTransfer ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.label}>Pay via {checkout.manualTransfer.provider}</Text>
                <Text style={styles.transferDetail}>{checkout.manualTransfer.account.accountTitle}</Text>
                <Text style={styles.transferDetail}>
                  {checkout.manualTransfer.account.numberDisplay ?? checkout.manualTransfer.account.number}
                </Text>
                {checkout.manualTransfer.description ? (
                  <Text style={styles.hint}>{checkout.manualTransfer.description}</Text>
                ) : null}

                <View style={styles.divider} />
                <Text style={styles.label}>Upload your transfer receipt</Text>
                {receiptUri ? <Image source={{ uri: receiptUri }} style={styles.receiptPreview} /> : null}
                <Pressable style={styles.secondaryButton} onPress={pickReceipt} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>
                    {receiptUri ? "Choose a different photo" : "Choose receipt screenshot"}
                  </Text>
                </Pressable>
                <TextInput
                  style={styles.notesInput}
                  value={transactionId}
                  onChangeText={setTransactionId}
                  placeholder="Transaction ID (optional)"
                  placeholderTextColor="#9AA5B1"
                  accessibilityLabel="Transaction ID (optional)"
                />
                <Pressable
                  style={[styles.primaryButton, (!receiptUri || isUploading) && styles.primaryButtonDisabled]}
                  onPress={submitReceipt}
                  disabled={!receiptUri || isUploading}
                  accessibilityRole="button"
                >
                  {isUploading ? (
                    <Spinner size="sm" color={colors.brand.foreground} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit receipt</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.hint}>Waiting for payment confirmation…</Text>
                <Pressable style={styles.secondaryButton} onPress={checkPaymentStatus} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>I've paid — check status</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : request && request.status === "requested" ? (
          <View style={styles.card}>
            <View style={styles.matchingBadge}>
              <Spinner size="md" color={colors.brand.DEFAULT} />
            </View>
            <Text style={styles.matchingTitle}>Finding you a doctor…</Text>
            <Text style={styles.hint}>
              We're matching you with an available doctor within {SUNDAY_MATCH_WITHIN_MINUTES} minutes. You'll
              see it here as soon as it's confirmed.
            </Text>
            {request.patientNotes ? <Text style={styles.notesEcho}>“{request.patientNotes}”</Text> : null}
          </View>
        ) : request && request.status === "assigned" && request.doctor ? (
          <View style={styles.card}>
            <View style={styles.doctorRow}>
              {request.doctor.avatarUrl ? (
                <Image source={{ uri: resolveMediaUrl(request.doctor.avatarUrl) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{request.doctor.name[0]}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.doctorName}>{request.doctor.name}</Text>
                <Text style={styles.specialty}>{request.doctor.specialty}</Text>
              </View>
            </View>
            {request.scheduledStart ? (
              <Text style={styles.time}>{formatKarachi(request.scheduledStart)}</Text>
            ) : null}
            <Text style={styles.hint}>Your Sunday consult is confirmed. Join it from Appointments.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push("/(tabs)/appointments")} accessibilityRole="button">
              <Text style={styles.primaryButtonText}>Go to appointments</Text>
            </Pressable>
          </View>
        ) : request && (request.status === "completed" || request.status === "cancelled") ? (
          <View style={styles.card}>
            <Text style={styles.matchingTitle}>
              {request.status === "completed" ? "Your Sunday consult is complete" : "Request cancelled"}
            </Text>
            <Text style={styles.hint}>You can submit a new request next Sunday.</Text>
            <Pressable style={styles.primaryButton} onPress={() => setRequest(null)} accessibilityRole="button">
              <Text style={styles.primaryButtonText}>Request again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.matchingTitle}>Free 10-minute video consult</Text>
            <Text style={styles.hint}>
              Every Sunday verified doctors pick patients for a free consult. No doctor picker — share your
              history and an available doctor will pick your request.
            </Text>

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.notesInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="03xx-xxxxxxx"
              placeholderTextColor="#9AA5B1"
              accessibilityLabel="Phone number"
            />

            <Text style={styles.label}>Your medical history</Text>
            <Text style={styles.hint}>
              Answer every question — write &quot;None&quot; if it does not apply. Doctors read this before picking your
              request.
            </Text>
            {HISTORY_QUESTIONS.map((q, index) => (
              <View key={q.key}>
                <Text style={styles.label}>
                  {index + 1}. {q.text}
                </Text>
                <TextInput
                  style={styles.notesInput}
                  value={history[q.key] ?? ""}
                  onChangeText={(value) => setHistory((prev) => ({ ...prev, [q.key]: value }))}
                  multiline
                  maxLength={2000}
                  placeholder="Type your answer"
                  placeholderTextColor="#9AA5B1"
                  accessibilityLabel={q.text}
                />
              </View>
            ))}

            <Text style={styles.label}>Can you contribute a small fee?</Text>
            <Pressable
              style={[styles.choiceRow, affordability === "cannot_afford" && styles.choiceRowActive]}
              onPress={() => setAffordability("cannot_afford")}
              accessibilityRole="button"
              accessibilityState={{ selected: affordability === "cannot_afford" }}
            >
              <Ionicons
                name={affordability === "cannot_afford" ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={colors.brand.DEFAULT}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>No, keep it free</Text>
                <Text style={styles.choiceHint}>We'll match you with a doctor at no cost.</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.choiceRow, affordability === "pay_fee" && styles.choiceRowActive]}
              onPress={() => setAffordability("pay_fee")}
              accessibilityRole="button"
              accessibilityState={{ selected: affordability === "pay_fee" }}
            >
              <Ionicons
                name={affordability === "pay_fee" ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={colors.brand.DEFAULT}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>Yes, contribute Rs. {SUNDAY_CONTRIBUTION_FEE_PKR}</Text>
                <Text style={styles.choiceHint}>Helps us keep this free for patients who can't pay.</Text>
              </View>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.primaryButton} onPress={submit} disabled={isSubmitting} accessibilityRole="button">
              {isSubmitting ? (
                <Spinner size="sm" color={colors.brand.foreground} />
              ) : (
                <Text style={styles.primaryButtonText}>Request Sunday consult</Text>
              )}
            </Pressable>
          </View>
        )}
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
  divider: { height: 1, backgroundColor: colors.neutral.border, marginVertical: 12 },
  label: { fontFamily: fonts.medium, fontSize: 12, color: "#888", textTransform: "uppercase", marginTop: 8 },
  transferDetail: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  hint: { fontFamily: fonts.regular, color: "#666" },
  notesEcho: { fontFamily: fonts.regular, color: "#666", fontStyle: "italic", marginTop: 4 },
  error: { color: "#c62828", fontFamily: fonts.regular },
  time: { fontFamily: fonts.semibold, fontSize: 14, color: colors.neutral.foreground },
  matchingBadge: { alignSelf: "center", marginVertical: 8 },
  matchingTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.neutral.foreground, textAlign: "center" },
  doctorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.neutral.muted },
  avatarPlaceholder: { backgroundColor: colors.brand.muted, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.bold, color: colors.brand.mutedForeground, fontSize: 18 },
  doctorName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.neutral.foreground },
  specialty: { fontFamily: fonts.regular, fontSize: 13, color: "#666" },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 44,
    textAlignVertical: "top",
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
    marginTop: 6,
  },
  choiceRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  choiceRowActive: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.brand.muted },
  choiceTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.neutral.foreground },
  choiceHint: { fontFamily: fonts.regular, fontSize: 12, color: "#666", marginTop: 2 },
  primaryButton: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 15 },
  secondaryButton: {
    backgroundColor: colors.neutral.muted,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: { color: colors.neutral.foreground, fontFamily: fonts.medium, fontSize: 14 },
  receiptPreview: { width: "100%", height: 180, borderRadius: 10, marginTop: 8 },
  amount: { fontFamily: fonts.bold, fontSize: 26, color: colors.neutral.foreground },
});
