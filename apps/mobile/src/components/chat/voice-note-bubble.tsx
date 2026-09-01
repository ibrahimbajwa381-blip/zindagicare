import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus, type AudioSource } from "expo-audio";
import { chatAttachmentSource } from "@/api/chat";
import { colors, fonts } from "@/lib/theme";
import { formatDuration } from "@/lib/format-duration";

export function VoiceNoteBubble({ url, isMine }: { url: string; isMine: boolean }) {
  const [source, setSource] = useState<AudioSource>(null);

  useEffect(() => {
    let cancelled = false;
    chatAttachmentSource(url).then((resolved) => {
      if (!cancelled) setSource(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (!source) return;
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) {
      player.seekTo(0);
    }
    player.play();
  };

  const progress = status.duration > 0 ? Math.min(status.currentTime / status.duration, 1) : 0;

  return (
    <Pressable style={styles.row} onPress={toggle} disabled={!source} hitSlop={4}>
      <View style={[styles.iconCircle, isMine ? styles.iconCircleMine : styles.iconCircleTheirs]}>
        <Ionicons
          name={status.playing ? "pause" : "play"}
          size={15}
          color={isMine ? colors.brand.foreground : colors.brand.DEFAULT}
        />
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.trackFill,
            { width: `${progress * 100}%` },
            isMine ? styles.trackFillMine : styles.trackFillTheirs,
          ]}
        />
      </View>
      <Text style={[styles.duration, isMine && styles.durationMine]}>
        {formatDuration(status.duration > status.currentTime ? status.duration - status.currentTime : status.duration)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 160 },
  iconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  iconCircleMine: { backgroundColor: "rgba(255,255,255,0.25)" },
  iconCircleTheirs: { backgroundColor: `${colors.brand.DEFAULT}1A` },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.12)", overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 2 },
  trackFillMine: { backgroundColor: "#fff" },
  trackFillTheirs: { backgroundColor: colors.brand.DEFAULT },
  duration: { fontFamily: fonts.regular, fontSize: 11, color: "#999", minWidth: 32, textAlign: "right" },
  durationMine: { color: "rgba(255,255,255,0.85)" },
});
