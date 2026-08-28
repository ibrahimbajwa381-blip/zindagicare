import { useState } from "react";
import { Stack, Redirect, Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts } from "@/lib/theme";

export default function SignupScreen() {
  const { user, isSigningIn, registerWithCredentials } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const onSignUp = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    try {
      await registerWithCredentials({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create your account. Please try again.");
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Create account", headerShown: true }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Book consultations and manage your care on the go.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor="#9AA5B1"
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9AA5B1"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone (03XXXXXXXXX)"
            placeholderTextColor="#9AA5B1"
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password (min 6 characters)"
            placeholderTextColor="#9AA5B1"
            secureTextEntry
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.button} onPress={onSignUp} disabled={isSigningIn}>
            {isSigningIn ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.buttonText}>Create account</Text>}
          </Pressable>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>Already have an account?</Text>
          <Link href="/(auth)/login" style={styles.loginLink}>
            Sign in
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
  loginRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  loginHint: { color: "#666", fontFamily: fonts.regular, fontSize: 14 },
  loginLink: { color: colors.brand.DEFAULT, fontFamily: fonts.semibold, fontSize: 14 },
});
