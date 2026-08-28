import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { colors, fonts } from "@/lib/theme";

const logo = require("../../assets/logo.png");

export default function LoginScreen() {
  const { user, isSigningIn, signInWithGoogle } = useAuth();

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <Image source={logo} resizeMode="contain" style={styles.logo} />
      <Text style={styles.subtitle}>Sign in to book care and get suggestions tailored to you.</Text>

      <Pressable style={styles.button} onPress={signInWithGoogle} disabled={isSigningIn}>
        {isSigningIn ? <Spinner size="sm" color={colors.brand.foreground} /> : <Text style={styles.buttonText}>Continue with Google</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
    backgroundColor: colors.neutral.background,
  },
  logo: { width: 200, height: 75, marginBottom: 8 },
  subtitle: {
    textAlign: "center",
    color: "#555",
    marginBottom: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.brand.DEFAULT,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    minWidth: 220,
    alignItems: "center",
  },
  buttonText: { color: colors.brand.foreground, fontFamily: fonts.semibold, fontSize: 16 },
});
