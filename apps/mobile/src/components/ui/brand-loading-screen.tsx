import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/lib/theme";

const logo = require("../../../assets/logo.png");

function useLoopedValue(duration: number, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: duration / 2,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, delay]);
  return value;
}

function Dot({ delay }: { delay: number }) {
  const t = useLoopedValue(1200, delay);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return <Animated.View style={[styles.dot, { transform: [{ scale }], opacity }]} />;
}

/** Mirrors apps/web/src/components/ui/brand-loading-screen.tsx — pulsing logo + glow + bouncing dots. */
export function BrandLoadingScreen({ caption }: { caption?: string }) {
  const pulse = useLoopedValue(2500);
  const logoScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const logoOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });

  return (
    <View style={styles.container} accessible accessibilityRole="progressbar" accessibilityLabel={caption ?? "Loading"}>
      <View style={styles.logoWrap}>
        <Animated.View
          style={[
            styles.glow,
            { transform: [{ scale: glowScale }], opacity: glowOpacity },
          ]}
        />
        <Animated.Image
          source={logo}
          resizeMode="contain"
          style={[styles.logo, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}
        />
      </View>

      <View style={styles.dots}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>

      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral.background,
    gap: 20,
  },
  logoWrap: {
    width: 160,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.brand.light,
  },
  logo: {
    width: 160,
    height: 60,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.DEFAULT,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#64748b",
  },
});
