import { useEffect, useRef, useState } from "react";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  checkoutConsult,
  completeTestPayment,
  getPaymentStatus,
  uploadPaymentReceipt,
  type CheckoutResult,
} from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";
import { formatKarachi } from "@/lib/format-date";

export default function CheckoutScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { doctorId, slotId, startAt } = useLocalSearchParams<{
    doctorId: string;
    slotId: string;
    startAt: string;
  }>();
  const router = useRouter();

  const [notes, setNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isBookingRef = useRef(false);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const book = async () => {
    if (isBookingRef.current) return;
    isBookingRef.current = true;
    setIsBooking(true);
    setError(null);
    try {
      const res = await checkoutConsult({ doctorId, slotId, patientNotes: notes || undefined });
      setResult(res);
      startPolling(res.paymentId);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Booking failed. Please try again.");
    } finally {
      isBookingRef.current = false;
      setIsBooking(false);
    }
  };

  const startPolling = (paymentId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getPaymentStatus(paymentId);
        if (status.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsPaid(true);
        }
      } catch {
        // Keep polling silently — a transient network error shouldn't stop the flow.
      }
    }, 3000);
  };

  const confirmDummyPayment = async () => {
    if (!result) return;
    setIsConfirming(true);
    try {
      await completeTestPayment(result.paymentId);
      setIsPaid(true);
      if (pollRef.current) clearInterval(pollRef.current);
    } catch (e) {
      Alert.alert("Couldn't confirm payment", e instanceof ApiRequestError ? e.message : "Please try again");
    } finally {
      setIsConfirming(false);
    }
  };

  const pickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to attach your receipt.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!picked.canceled && picked.assets[0]) {
      setReceiptUri(picked.assets[0].uri);
    }
  };

  const submitReceipt = async () => {
    if (!result || !receiptUri) return;
    setIsUploading(true);
    try {
      await uploadPaymentReceipt(
        result.paymentId,
        { uri: receiptUri, name: "receipt.jpg", type: "image/jpeg" },
        transactionId || undefined,
      );
      setIsPaid(true);
      if (pollRef.current) clearInterval(pollRef.current);
    } catch (e) {
      Alert.alert("Couldn't submit receipt", e instanceof Error ? e.message : "Please try again");
    } finally {
      setIsUploading(false);
    }
  };

  if (isAuthLoading) {
    return <BrandLoadingScreen />;
  }
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isPaid) {
    return (
      <>
        <Stack.Screen options={{ title: "Booking confirmed" }} />
        <View style={styles.centered}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={36} color={colors.brand.DEFAULT} />
          </View>
          <Text style={styles.successTitle}>Appointment confirmed</Text>
          <Text style={styles.hint}>Your consult is booked. You can view it in Appointments.</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace("/(tabs)/appointments")}
            accessibilityRole="button"
            accessibilityLabel="View appointments"
          >
            <Text style={styles.primaryButtonText}>View appointments</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Confirm booking" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.time}>{formatKarachi(startAt)}</Text>
        </View>

        {!result ? (
          <View style={styles.card}>
            <Text style={styles.label}>Notes for the doctor (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Describe your symptoms or reason for the visit"
              placeholderTextColor="#9AA5B1"
              accessibilityLabel="Notes for the doctor (optional)"
            />
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Pressable
              style={styles.primaryButton}
              onPress={book}
              disabled={isBooking}
              accessibilityRole="button"
              accessibilityLabel="Confirm booking"
              accessibilityState={{ disabled: isBooking, busy: isBooking }}
            >
              {isBooking ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.primaryButtonText}>Confirm booking</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Amount due</Text>
            <Text style={styles.amount}>Rs. {result.amount}</Text>

            {result.manualTransfer ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.label}>Pay via {result.manualTransfer.provider}</Text>
                <Text style={styles.transferDetail}>{result.manualTransfer.account.accountTitle}</Text>
                <Text style={styles.transferDetail}>
                  {result.manualTransfer.account.numberDisplay ?? result.manualTransfer.account.number}
                </Text>
                {result.manualTransfer.description ? (
                  <Text style={styles.hint}>{result.manualTransfer.description}</Text>
                ) : null}

                <View style={styles.divider} />
                <Text style={styles.label}>Upload your transfer receipt</Text>
                {receiptUri ? (
                  <Image source={{ uri: receiptUri }} style={styles.receiptPreview} />
                ) : null}
                <Pressable
                  style={styles.secondaryButton}
                  onPress={pickReceipt}
                  accessibilityRole="button"
                  accessibilityLabel={receiptUri ? "Choose a different photo" : "Choose receipt screenshot"}
                >
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
                  accessibilityLabel="Submit receipt"
                  accessibilityState={{ disabled: !receiptUri || isUploading, busy: isUploading }}
                >
                  {isUploading ? (
                    <Spinner size="sm" color={colors.brand.foreground} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit receipt</Text>
                  )}
                </Pressable>
              </>
            ) : result.testMode ? (
              <Pressable
                style={styles.primaryButton}
                onPress={confirmDummyPayment}
                disabled={isConfirming}
                accessibilityRole="button"
                accessibilityLabel="I've paid (test mode)"
                accessibilityState={{ disabled: isConfirming, busy: isConfirming }}
              >
                {isConfirming ? (
                  <Spinner size="sm" color={colors.brand.foreground} />
                ) : (
                  <Text style={styles.primaryButtonText}>I've paid (test mode)</Text>
                )}
              </Pressable>
            ) : (
              <Text style={styles.hint}>Waiting for payment confirmation…</Text>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 4,
    ...cardShadow,
  },
  divider: { height: 1, backgroundColor: colors.neutral.border, marginVertical: 12 },
  time: { fontFamily: fonts.semibold, fontSize: 16, color: colors.neutral.foreground },
  label: { fontFamily: fonts.medium, fontSize: 12, color: "#888", textTransform: "uppercase", marginTop: 4 },
  transferDetail: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  hint: { fontFamily: fonts.regular, color: "#666", textAlign: "center" },
  error: { color: "#c62828", fontFamily: fonts.regular },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
    marginTop: 6,
  },
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
  successBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successBadgeText: { fontSize: 32, color: colors.brand.DEFAULT, fontFamily: fonts.bold },
  successTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.neutral.foreground },
});
