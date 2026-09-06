import { useState } from "react";
import { Stack, Redirect, Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/locale-context";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts } from "@/lib/theme";
import { PAKISTAN_CITIES } from "@/lib/pakistan-cities";

const ACCOUNT_TYPE_VALUES = ["patient", "doctor", "nurse", "physiotherapist", "lab", "other"] as const;

export default function SignupScreen() {
  const { user, isSigningIn, registerWithCredentials } = useAuth();
  const t = useTranslations();
  const ACCOUNT_TYPES = ACCOUNT_TYPE_VALUES.map((value) => ({
    value,
    label: t.auth.signup.accountTypes[value],
  }));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState<(typeof ACCOUNT_TYPE_VALUES)[number]>("patient");
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const onSignUp = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError(t.auth.signup.errors.nameRequired);
      return;
    }
    if (!email.trim()) {
      setError(t.auth.signup.errors.generic);
      return;
    }
    if (!phone.trim()) {
      setError(t.auth.signup.errors.generic);
      return;
    }
    if (!city.trim()) {
      setError(t.auth.signup.errors.cityRequired);
      return;
    }
    const ageValue = Number(age.trim());
    if (!age.trim() || !Number.isInteger(ageValue) || ageValue < 13 || ageValue > 120) {
      setError(t.auth.signup.errors.ageInvalid);
      return;
    }
    if (password.length < 6) {
      setError(t.auth.signup.errors.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.signup.errors.passwordMismatch);
      return;
    }
    try {
      const birthYear = new Date().getFullYear() - ageValue;
      await registerWithCredentials({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        phone: phone.trim(),
        city: city.trim(),
        dateOfBirth: `${birthYear}-01-01`,
        accountType,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.auth.signup.errors.generic);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t.auth.signup.headerTitle, headerShown: true }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t.auth.signup.title}</Text>
        <Text style={styles.subtitle}>{t.auth.signup.subtitle}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t.auth.signup.namePlaceholder}
            placeholderTextColor="#9AA5B1"
            accessibilityLabel={t.auth.signup.namePlaceholder}
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t.auth.signup.emailPlaceholder}
            placeholderTextColor="#9AA5B1"
            autoCapitalize="none"
            keyboardType="email-address"
            accessibilityLabel={t.auth.signup.emailPlaceholder}
          />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={t.auth.signup.phonePlaceholder}
            placeholderTextColor="#9AA5B1"
            keyboardType="phone-pad"
            accessibilityLabel={t.auth.signup.phonePlaceholder}
          />

          <Text style={styles.label}>{t.auth.signup.cityLabel}</Text>
          <TextInput
            style={styles.input}
            value={cityPickerOpen ? cityQuery : city}
            onFocus={() => {
              setCityQuery("");
              setCityPickerOpen(true);
            }}
            onChangeText={(text) => {
              setCityQuery(text);
              setCity("");
            }}
            onBlur={() => setCityPickerOpen(false)}
            placeholder={t.auth.signup.cityPlaceholder}
            placeholderTextColor="#9AA5B1"
            accessibilityLabel={t.auth.signup.cityLabel}
          />
          {cityPickerOpen ? (
            <View style={styles.cityList}>
              <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {PAKISTAN_CITIES.filter((c) =>
                  c.toLowerCase().includes(cityQuery.trim().toLowerCase()),
                ).map((c) => (
                  <Pressable
                    key={c}
                    style={styles.cityOption}
                    onPress={() => {
                      setCity(c);
                      setCityQuery(c);
                      setCityPickerOpen(false);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cityOptionText}>{c}</Text>
                  </Pressable>
                ))}
                {PAKISTAN_CITIES.filter((c) =>
                  c.toLowerCase().includes(cityQuery.trim().toLowerCase()),
                ).length === 0 ? (
                  <View style={styles.cityOption}>
                    <Text style={styles.cityOptionText}>{t.auth.signup.noMatchingCity}</Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            value={age}
            onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ""))}
            placeholder={t.auth.signup.agePlaceholder}
            placeholderTextColor="#9AA5B1"
            keyboardType="number-pad"
            maxLength={3}
            accessibilityLabel={t.auth.signup.agePlaceholder}
          />

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={t.auth.signup.passwordPlaceholder}
            placeholderTextColor="#9AA5B1"
            secureTextEntry
            accessibilityLabel={t.auth.signup.passwordPlaceholder}
          />
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t.auth.signup.confirmPasswordPlaceholder}
            placeholderTextColor="#9AA5B1"
            secureTextEntry
            accessibilityLabel={t.auth.signup.confirmPasswordPlaceholder}
          />

          <Text style={styles.label}>{t.auth.signup.registeringAs}</Text>
          <View style={styles.chipRow}>
            {ACCOUNT_TYPES.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.chip, accountType === option.value && styles.chipActive]}
                onPress={() => setAccountType(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: accountType === option.value }}
              >
                <Text style={[styles.chipText, accountType === option.value && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            style={styles.button}
            onPress={onSignUp}
            disabled={isSigningIn}
            accessibilityRole="button"
            accessibilityLabel={t.auth.signup.createAccount}
            accessibilityState={{ disabled: isSigningIn, busy: isSigningIn }}
          >
            {isSigningIn ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.buttonText}>{t.auth.signup.createAccount}</Text>}
          </Pressable>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>{t.auth.signup.alreadyHaveAccount}</Text>
          <Link href="/(auth)/login" style={styles.loginLink} accessibilityRole="link">
            {t.auth.signup.signIn}
          </Link>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
    backgroundColor: colors.neutral.background,
  },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.neutral.foreground },
  subtitle: {
    textAlign: "center",
    color: "#555",
    marginBottom: 8,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  form: { width: "100%", maxWidth: 340, gap: 10 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.neutral.foreground, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },
  selectValue: { fontFamily: fonts.regular, color: colors.neutral.foreground },
  selectPlaceholder: { fontFamily: fonts.regular, color: "#9AA5B1" },
  cityList: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  cityOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  cityOptionText: { fontFamily: fonts.regular, color: colors.neutral.foreground },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  chipText: { fontFamily: fonts.regular, fontSize: 13, color: colors.neutral.foreground },
  chipTextActive: { color: colors.brand.foreground, fontFamily: fonts.semibold },
  error: { color: "#c62828", fontFamily: fonts.regular, fontSize: 13 },
  button: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 16 },
  loginRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  loginHint: { color: "#666", fontFamily: fonts.regular, fontSize: 14 },
  loginLink: { color: colors.brand.DEFAULT, fontFamily: fonts.semibold, fontSize: 14 },
});
