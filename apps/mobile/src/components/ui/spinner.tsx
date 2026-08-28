import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, type ColorValue } from "react-native";
import { colors } from "@/lib/theme";

const SIZES = {
  xs: { box: 14, border: 2 },
  sm: { box: 18, border: 2 },
  md: { box: 24, border: 3 },
  lg: { box: 32, border: 3 },
  xl: { box: 48, border: 4 },
} as const;

/** Mirrors apps/web/src/components/ui/spinner.tsx — a ring spinner (animate-spin, border-t-transparent). */
export function Spinner({
  size = "md",
  color = colors.brand.DEFAULT,
}: {
  size?: keyof typeof SIZES;
  color?: ColorValue;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const { box, border } = SIZES[size];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: box,
          height: box,
          borderRadius: box / 2,
          borderWidth: border,
          borderColor: color,
          borderTopColor: "transparent",
          transform: [{ rotate }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {},
});
