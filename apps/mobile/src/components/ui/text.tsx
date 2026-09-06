import { Text as RNText, type TextProps } from "react-native";
import { useLocale } from "@/lib/locale-context";

/**
 * Drop-in replacement for RN's Text that right-aligns Urdu and left-aligns
 * English by default, live (no I18nManager/app-reload). An explicit
 * textAlign/writingDirection in `style` still wins.
 */
export function Text({ style, ...props }: TextProps) {
  const { isRTL } = useLocale();
  return (
    <RNText
      style={[{ textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }, style]}
      {...props}
    />
  );
}
