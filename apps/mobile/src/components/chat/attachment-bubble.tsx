import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { chatAttachmentSource } from "@/api/chat";
import { colors, fonts } from "@/lib/theme";
import { VoiceNoteBubble } from "./voice-note-bubble";

function fileLabelFromMime(mime: string): string {
  if (mime === "application/pdf") return "PDF document";
  if (mime === "application/msword" || mime.includes("wordprocessingml")) return "Word document";
  return "File";
}

function FileTile({ url, mime, isMine }: { url: string; mime: string; isMine: boolean }) {
  const [isOpening, setIsOpening] = useState(false);

  const open = async () => {
    setIsOpening(true);
    try {
      const source = await chatAttachmentSource(url);
      const destination = new File(new Directory(Paths.cache), url.split("/").pop() ?? "attachment");
      const file = await File.downloadFileAsync(source.uri, destination, {
        headers: source.headers,
        idempotent: true,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: mime });
      }
    } catch {
      Alert.alert("Couldn't open file", "Please try again.");
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Pressable
      style={styles.fileTile}
      onPress={open}
      disabled={isOpening}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={isOpening ? `Opening ${fileLabelFromMime(mime)}` : `Open ${fileLabelFromMime(mime)}`}
    >
      <View style={[styles.fileIcon, isMine ? styles.fileIconMine : styles.fileIconTheirs]}>
        {isOpening ? (
          <ActivityIndicator size="small" color={isMine ? colors.brand.foreground : colors.brand.DEFAULT} />
        ) : (
          <Ionicons name="document-text-outline" size={18} color={isMine ? colors.brand.foreground : colors.brand.DEFAULT} />
        )}
      </View>
      <Text style={[styles.fileLabel, isMine && styles.fileLabelMine]} numberOfLines={1}>
        {fileLabelFromMime(mime)}
      </Text>
    </Pressable>
  );
}

function ImageTile({ url }: { url: string }) {
  const [source, setSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    chatAttachmentSource(url).then((resolved) => {
      if (!cancelled) setSource(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!source) {
    return (
      <View style={[styles.image, styles.imageLoading]}>
        <ActivityIndicator size="small" color={colors.brand.DEFAULT} />
      </View>
    );
  }

  return <Image source={source} style={styles.image} resizeMode="cover" />;
}

export function AttachmentBubble({ url, mime, isMine }: { url: string; mime: string; isMine: boolean }) {
  if (mime.startsWith("image/")) {
    return <ImageTile url={url} />;
  }
  if (mime.startsWith("audio/")) {
    return <VoiceNoteBubble url={url} isMine={isMine} />;
  }
  return <FileTile url={url} mime={mime} isMine={isMine} />;
}

const styles = StyleSheet.create({
  image: { width: 200, height: 200, borderRadius: 12 },
  imageLoading: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.05)" },
  fileTile: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 160, maxWidth: 220 },
  fileIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  fileIconMine: { backgroundColor: "rgba(255,255,255,0.25)" },
  fileIconTheirs: { backgroundColor: `${colors.brand.DEFAULT}1A` },
  fileLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.neutral.foreground },
  fileLabelMine: { color: colors.brand.foreground },
});
