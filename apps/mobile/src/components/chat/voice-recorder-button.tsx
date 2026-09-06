import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { uploadChatVoiceNote } from "@/api/chat";
import { colors, fonts } from "@/lib/theme";
import { formatDuration } from "@/lib/format-duration";

export function VoiceRecorderButton({
  threadId,
  onUploaded,
  disabled,
}: {
  threadId: string;
  onUploaded: (attachment: { url: string; mime: string }) => Promise<void> | void;
  disabled?: boolean;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [isUploading, setIsUploading] = useState(false);

  const startRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert("Microphone access needed", "Enable microphone access in Settings to send voice notes.");
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const cancelRecording = async () => {
    if (recorder.isRecording) {
      await recorder.stop();
    }
  };

  const stopAndSend = async () => {
    if (!recorder.isRecording) return;
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return;

    setIsUploading(true);
    try {
      const uploaded = await uploadChatVoiceNote(threadId, uri, "audio/mp4");
      await onUploaded({ url: uploaded.url, mime: uploaded.mimeType });
    } catch {
      Alert.alert("Couldn't send voice note", "Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  if (recorderState.isRecording) {
    return (
      <View style={styles.recordingRow}>
        <View style={styles.recDot} />
        <Text style={styles.recordingTime}>{formatDuration(recorderState.durationMillis / 1000)}</Text>
        <Pressable
          testID="voice-recorder-cancel"
          onPress={cancelRecording}
          style={styles.cancelButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel voice note"
        >
          <Ionicons name="trash-outline" size={18} color="#c62828" />
        </Pressable>
        <Pressable
          testID="voice-recorder-send"
          onPress={stopAndSend}
          style={styles.sendButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Send voice note"
        >
          <Ionicons name="send" size={18} color={colors.brand.foreground} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      style={styles.micButton}
      onPress={startRecording}
      disabled={disabled || isUploading}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isUploading ? "Uploading voice note" : "Record a voice note"}
      accessibilityState={{ disabled: disabled || isUploading }}
    >
      <Ionicons name={isUploading ? "cloud-upload-outline" : "mic-outline"} size={20} color={colors.brand.DEFAULT} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#c62828" },
  recordingTime: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.neutral.foreground },
  cancelButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
});
