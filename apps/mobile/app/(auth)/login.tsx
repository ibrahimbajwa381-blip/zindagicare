import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Redirect, Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isExpoGo, useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/locale-context";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts } from "@/lib/theme";

const logo = require("../../assets/logo.png");

export default function LoginScreen() {
  const { user, isSigningIn, signInWithGoogle, signInWithCredentials } = useAuth();
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Redirect href={user.roles?.includes("doctor") ? "/(doctor)" : "/(tabs)"} />;
  }

  const onSignIn = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError(t.auth.login.genericError);
      return;
    }
    try {
      await signInWithCredentials(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.auth.login.genericError);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Image source={logo} resizeMode="contain" style={styles.logo} />
      <Text style={styles.subtitle}>{t.auth.login.subtitle}</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t.auth.login.emailPlaceholder}
          placeholderTextColor="#9AA5B1"
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel={t.auth.login.emailPlaceholder}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t.auth.login.passwordPlaceholder}
          placeholderTextColor="#9AA5B1"
          secureTextEntry
          accessibilityLabel={t.auth.login.passwordPlaceholder}
        />
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          style={styles.button}
          onPress={onSignIn}
          disabled={isSigningIn}
          accessibilityRole="button"
          accessibilityLabel={t.auth.login.signIn}
          accessibilityState={{ disabled: isSigningIn, busy: isSigningIn }}
        >
          {isSigningIn ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.buttonText}>{t.auth.login.signIn}</Text>}
        </Pressable>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t.auth.login.or}</Text>
        <View style={styles.dividerLine} />
      </View>

      {isExpoGo ? (
        <Text style={styles.expoGoHint}>{t.auth.login.expoGoHint}</Text>
      ) : (
        <Pressable
          style={styles.googleButton}
          onPress={async () => {
            setError(null);
            try {
              await signInWithGoogle();
            } catch (e) {
              setError(e instanceof Error ? e.message : t.auth.login.googleError);
            }
          }}
          disabled={isSigningIn}
          accessibilityRole="button"
          accessibilityLabel={t.auth.login.continueWithGoogle}
          accessibilityState={{ disabled: isSigningIn, busy: isSigningIn }}
        >
          {isSigningIn ? (
            <Spinner size="sm" color={colors.brand.DEFAULT} />
          ) : (
            <Text style={styles.googleButtonText}>{t.auth.login.continueWithGoogle}</Text>
          )}
        </Pressable>
      )}

      <View style={styles.signupRow}>
        <Text style={styles.signupHint}>{t.auth.login.noAccount}</Text>
        <Link href="/(auth)/signup" style={styles.signupLink} accessibilityRole="link">
          {t.auth.login.signUp}
        </Link>
      </View>
    </ScrollView>
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
  logo: { width: 200, height: 75, marginBottom: 4 },
  subtitle: {
    textAlign: "center",
    color: "#555",
    marginBottom: 8,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  form: { width: "100%", maxWidth: 340, gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },
  error: { color: "#c62828", fontFamily: fonts.regular, fontSize: 13 },
  button: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", width: "100%", maxWidth: 340, gap: 10, marginTop: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.neutral.border },
  dividerText: { color: "#888", fontFamily: fonts.regular, fontSize: 13 },
  googleButton: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    minWidth: 220,
    alignItems: "center",
  },
  googleButtonText: { color: colors.neutral.foreground, fontFamily: fonts.semibold, fontSize: 15 },
  expoGoHint: {
    color: "#888",
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: "center",
    maxWidth: 300,
  },
  signupRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  signupHint: { color: "#666", fontFamily: fonts.regular, fontSize: 14 },
  signupLink: { color: colors.brand.DEFAULT, fontFamily: fonts.semibold, fontSize: 14 },
});
