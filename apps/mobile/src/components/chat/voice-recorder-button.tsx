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
import { ApiRequestError } from "@/api/client";
import { UploadTimeoutError } from "@/lib/file-upload";

/** Network/timeouts (no status), 408, 429 and 5xx may succeed on retry; other 4xx won't. */
function isRetryableStatus(status: number) {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}
import { colors, fonts } from "@/lib/theme";
import { formatDuration } from "@/lib/format-duration";

// Speech needs far less than the music-grade preset (128 kbps stereo): ~4x smaller files, same AAC/.m4a output.
const VOICE_NOTE_RECORDING = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
};

export function VoiceRecorderButton({
  threadId,
  onUploaded,
  disabled,
}: {
  threadId: string;
  onUploaded: (attachment: { url: string; mime: string }) => Promise<void> | void;
  disabled?: boolean;
}) {
  const recorder = useAudioRecorder(VOICE_NOTE_RECORDING);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [isUploading, setIsUploading] = useState(false);

  const startRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert("Microphone access needed", "Enable microphone access in Settings to send voice notes.");
      return;
    }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      Alert.alert(
        "Couldn't start recording",
        "Make sure no other app is using the microphone, then try again.",
      );
    }
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
    if (!uri) {
      Alert.alert("Nothing was recorded", "Please try again.");
      return;
    }
    await upload(uri);
  };

  // VOICE_NOTE_RECORDING (HIGH_QUALITY-based) writes AAC in an .m4a (MPEG-4) container on iOS and Android.
  // `uploaded` is passed back on retry so a finished upload is reused; the server
  // treats a resend with the same attachment URL as the original message (no duplicate).
  const upload = async (uri: string, uploaded?: { url: string; mimeType: string }) => {
    setIsUploading(true);
    try {
      uploaded ??= await uploadChatVoiceNote(threadId, uri, "audio/mp4");
      await onUploaded({ url: uploaded.url, mime: uploaded.mimeType });
    } catch (e) {
      const message =
        e instanceof ApiRequestError || e instanceof UploadTimeoutError ? e.message : "Please try again.";
      if (e instanceof ApiRequestError && !isRetryableStatus(e.status)) {
        // Wrong type/size or auth: the same recording can't succeed on retry.
        Alert.alert("Voice note not sent", message);
      } else {
        // Keep the recorded file so the user can retry without re-recording.
        const done = uploaded;
        Alert.alert("Couldn't send voice note", message, [
          { text: "Discard", style: "cancel" },
          { text: "Retry", onPress: () => void upload(uri, done) },
        ]);
      }
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
