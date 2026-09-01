import { useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { uploadChatFile } from "@/api/chat";
import { colors } from "@/lib/theme";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function FileAttachmentButton({
  threadId,
  onUploaded,
  disabled,
}: {
  threadId: string;
  onUploaded: (attachment: { url: string; mime: string }) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);

  const pickAndSend = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_BYTES) {
      Alert.alert("File too large", "Please choose a file under 20 MB.");
      return;
    }

    setIsUploading(true);
    try {
      const mimeType = asset.mimeType ?? "application/octet-stream";
      const uploaded = await uploadChatFile(threadId, asset.uri, mimeType, asset.name);
      await onUploaded({ url: uploaded.url, mime: uploaded.mimeType });
    } catch {
      Alert.alert("Couldn't send file", "Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Pressable style={styles.button} onPress={pickAndSend} disabled={disabled || isUploading} hitSlop={8}>
      <Ionicons name={isUploading ? "cloud-upload-outline" : "attach-outline"} size={20} color={colors.brand.DEFAULT} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
});
