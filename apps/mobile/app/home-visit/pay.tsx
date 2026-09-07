import { useEffect, useRef, useState } from "react";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  checkoutHomeVisit,
  type HomeVisitCheckoutResult,
} from "@/api/home-visits";
import { completeTestPayment, getPaymentStatus, uploadPaymentReceipt } from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts, cardShadow } from "@/lib/theme";

export default function HomeVisitPayScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<HomeVisitCheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await checkoutHomeVisit(visitId);
        if (cancelled) return;
        setResult(res);
        startPolling(res.paymentId);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ApiRequestError ? e.message : "Couldn't start payment. Please try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

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
        <Stack.Screen options={{ title: "Payment confirmed" }} />
        <View style={styles.centered}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={40} color={colors.brand.DEFAULT} />
          </View>
          <Text style={styles.successTitle}>Payment confirmed</Text>
          <Text style={styles.hint}>Your home visit request is booked. We'll notify you once a provider is assigned.</Text>
          <Pressable
            style={[styles.primaryButton, styles.successButton]}
            onPress={() => router.replace("/home-visit")}
            accessibilityRole="button"
            accessibilityLabel="View home visits"
          >
            <Text style={styles.primaryButtonText}>View home visits</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Pay for your visit" }} />
        <BrandLoadingScreen />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Pay for your visit" }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.card}>
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          </View>
        ) : result ? (
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
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 4,
    ...cardShadow,
  },
  divider: { height: 1, backgroundColor: colors.neutral.border, marginVertical: 12 },
  label: { fontFamily: fonts.medium, fontSize: 12, color: "#888", textTransform: "uppercase", marginTop: 4 },
  transferDetail: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },
  hint: { fontFamily: fonts.regular, color: "#666", textAlign: "center", lineHeight: 21 },
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
  successButton: { paddingHorizontal: 32, minWidth: 220, marginTop: 20, ...cardShadow },
});
