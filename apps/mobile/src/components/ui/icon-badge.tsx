import { StyleSheet, Text, View } from "react-native";
import { fonts } from "@/lib/theme";

export function IconBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: "#e53935",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: "#fff", fontFamily: fonts.semibold, fontSize: 9.5, lineHeight: 12 },
});
