import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import {
  getDoctorBankAccount,
  getDoctorEarnings,
  updateDoctorBankAccount,
  type DoctorBankAccount,
  type DoctorEarningsDetail,
} from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts, cardShadow } from "@/lib/theme";

function money(n: number) {
  return `Rs. ${n.toLocaleString()}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" });
}

const WITHDRAWAL_COLORS: Record<string, string> = {
  pending: "#F5A623",
  processing: colors.accent.DEFAULT,
  completed: "#16a34a",
  failed: "#c62828",
};

export default function DoctorEarningsScreen() {
  const [earnings, setEarnings] = useState<DoctorEarningsDetail | null>(null);
  const [bankAccount, setBankAccount] = useState<DoctorBankAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingBank, setEditingBank] = useState(false);
  const [form, setForm] = useState<DoctorBankAccount>({});
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [earningsRes, bankRes] = await Promise.all([getDoctorEarnings(), getDoctorBankAccount()]);
      setEarnings(earningsRes);
      setBankAccount(bankRes.bankAccount);
      setForm(bankRes.bankAccount ?? {});
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to load earnings");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveBank = async () => {
    if (!form.accountTitle?.trim() || !form.bankName?.trim() || !(form.accountNumber?.trim() || form.iban?.trim())) {
      Alert.alert("Missing details", "Account title, bank name, and account number or IBAN are required.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await updateDoctorBankAccount(form);
      setBankAccount(res.bankAccount);
      setEditingBank(false);
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof ApiRequestError ? e.message : "Please try again");
    } finally {
      setIsSaving(false);
    }
  };

  if (!earnings) {
    return error ? (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    ) : (
      <BrandLoadingScreen />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available balance</Text>
        <Text style={styles.balanceValue}>{money(earnings.availableBalance)}</Text>
        <View style={styles.balanceMetaRow}>
          <Text style={styles.balanceMeta}>Withdrawn: {money(earnings.totalWithdrawn)}</Text>
          <Text style={styles.balanceMeta}>Pending: {money(earnings.pendingWithdrawal)}</Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <Stat label="Earnings this month" value={money(earnings.earningsThisMonth)} />
        <Stat label="Total earnings" value={money(earnings.totalEarnings)} />
        <Stat label="Gross this month" value={money(earnings.grossRevenueThisMonth)} />
        <Stat label="Commission this month" value={money(earnings.platformCommissionThisMonth)} />
        <Stat label="Referral bonus" value={money(earnings.referralBonusEarnings)} />
        <Stat label="Completed paid consults" value={String(earnings.completedPaidConsults)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bank account</Text>
        {editingBank ? (
          <View style={{ gap: 10 }}>
            <TextInput
              style={styles.input}
              placeholder="Account title"
              placeholderTextColor="#9AA5B1"
              value={form.accountTitle ?? ""}
              onChangeText={(v) => setForm({ ...form, accountTitle: v })}
              accessibilityLabel="Account title"
            />
            <TextInput
              style={styles.input}
              placeholder="Bank name"
              placeholderTextColor="#9AA5B1"
              value={form.bankName ?? ""}
              onChangeText={(v) => setForm({ ...form, bankName: v })}
              accessibilityLabel="Bank name"
            />
            <TextInput
              style={styles.input}
              placeholder="Account number"
              placeholderTextColor="#9AA5B1"
              value={form.accountNumber ?? ""}
              onChangeText={(v) => setForm({ ...form, accountNumber: v })}
              accessibilityLabel="Account number"
            />
            <TextInput
              style={styles.input}
              placeholder="IBAN (optional)"
              placeholderTextColor="#9AA5B1"
              value={form.iban ?? ""}
              onChangeText={(v) => setForm({ ...form, iban: v })}
              autoCapitalize="characters"
              accessibilityLabel="IBAN (optional)"
            />
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => {
                  setForm(bankAccount ?? {});
                  setEditingBank(false);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={saveBank} disabled={isSaving} accessibilityRole="button">
                {isSaving ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.actionButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        ) : bankAccount ? (
          <View style={{ gap: 4 }}>
            <Text style={styles.bankLine}>{bankAccount.accountTitle}</Text>
            <Text style={styles.bankSub}>{bankAccount.bankName}</Text>
            <Text style={styles.bankSub}>{bankAccount.iban || bankAccount.accountNumber}</Text>
            <Pressable style={styles.editLink} onPress={() => setEditingBank(true)} accessibilityRole="button">
              <Ionicons name="create-outline" size={14} color={colors.brand.DEFAULT} />
              <Text style={styles.editLinkText}>Edit bank details</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.actionButton} onPress={() => setEditingBank(true)} accessibilityRole="button">
            <Text style={styles.actionButtonText}>Add bank account</Text>
          </Pressable>
        )}
      </View>

      {earnings.withdrawals.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout history</Text>
          {earnings.withdrawals.map((w) => (
            <View key={w.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{money(w.amount)}</Text>
                <Text style={styles.rowSub}>{formatDate(w.requestedAt)}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: `${WITHDRAWAL_COLORS[w.status] ?? "#888"}1A` }]}>
                <Text style={[styles.statusText, { color: WITHDRAWAL_COLORS[w.status] ?? "#888" }]}>{w.status}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent transactions</Text>
        {earnings.transactions.length === 0 ? (
          <Text style={styles.hint}>No transactions yet.</Text>
        ) : (
          earnings.transactions.map((t) => (
            <View key={t.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t.patient.name}</Text>
                <Text style={styles.rowSub}>
                  {formatDate(t.completedAt)} · {t.type}
                  {t.isReferralBonus ? " · referral bonus" : ""}
                </Text>
              </View>
              <Text style={styles.rowAmount}>+{money(t.amount)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#c62828", fontFamily: fonts.regular },
  hint: { color: "#666", fontFamily: fonts.regular, fontSize: 13 },

  balanceCard: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: 18,
    padding: 20,
    gap: 4,
  },
  balanceLabel: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  balanceValue: { fontFamily: fonts.bold, fontSize: 28, color: colors.brand.foreground },
  balanceMetaRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  balanceMeta: { fontFamily: fonts.regular, fontSize: 12, color: "rgba(255,255,255,0.85)" },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "47.5%", backgroundColor: "#fff", borderRadius: 16, padding: 14, gap: 4, ...cardShadow },
  statValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.neutral.foreground },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },

  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12, ...cardShadow },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neutral.foreground },

  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },
  actionRow: { flexDirection: "row", gap: 10 },
  actionButton: {
    flex: 1,
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  actionButtonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 14 },
  secondaryButton: { backgroundColor: colors.neutral.muted },
  secondaryButtonText: { color: colors.neutral.foreground, fontFamily: fonts.semibold, fontSize: 14 },

  bankLine: { fontFamily: fonts.semibold, fontSize: 14, color: colors.neutral.foreground },
  bankSub: { fontFamily: fonts.regular, fontSize: 13, color: "#666" },
  editLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  editLinkText: { fontFamily: fonts.medium, fontSize: 13, color: colors.brand.DEFAULT },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.neutral.foreground },
  rowSub: { fontFamily: fonts.regular, fontSize: 12, color: "#888" },
  rowAmount: { fontFamily: fonts.semibold, fontSize: 13.5, color: "#16a34a" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontFamily: fonts.semibold, fontSize: 11 },
});
