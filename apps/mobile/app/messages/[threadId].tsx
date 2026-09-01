import { useCallback, useRef, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listChatMessages, markChatThreadRead, sendChatMessage, type ChatMessage } from "@/api/chat";
import { ApiRequestError } from "@/api/client";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { AttachmentBubble } from "@/components/chat/attachment-bubble";
import { FileAttachmentButton } from "@/components/chat/file-attachment-button";
import { VoiceRecorderButton } from "@/components/chat/voice-recorder-button";
import { colors, fonts } from "@/lib/theme";

const POLL_MS = 5_000;

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit" });
}

export default function MessagesThreadScreen() {
  const { threadId, name } = useLocalSearchParams<{ threadId: string; name: string }>();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const res = await listChatMessages(threadId);
      setMessages(res.messages);
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof ApiRequestError ? e.message : "Failed to load messages");
    }
  }, [threadId]);

  useFocusEffect(
    useCallback(() => {
      load();
      markChatThreadRead(threadId).catch(() => {});
      pollRef.current = setInterval(() => load(true), POLL_MS);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load, threadId]),
  );

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setIsSending(true);
    setDraft("");
    try {
      await sendChatMessage(threadId, body);
      await load();
    } catch (e) {
      setDraft(body);
      setError(e instanceof ApiRequestError ? e.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const sendVoiceNote = async (attachment: { url: string; mime: string }) => {
    try {
      await sendChatMessage(threadId, "", attachment);
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to send voice note");
    }
  };

  const sendFile = async (attachment: { url: string; mime: string }) => {
    try {
      await sendChatMessage(threadId, "", attachment);
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Failed to send file");
    }
  };

  if (!messages) {
    return (
      <>
        <Stack.Screen options={{ title: name ?? "Conversation" }} />
        {error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : (
          <BrandLoadingScreen />
        )}
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: name ?? "Conversation" }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          inverted
          contentContainerStyle={styles.list}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.isMine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {item.attachmentUrl ? (
                  <AttachmentBubble
                    url={item.attachmentUrl}
                    mime={item.attachmentMime ?? "audio/mp4"}
                    isMine={item.isMine}
                  />
                ) : (
                  <Text style={[styles.bubbleText, item.isMine && styles.bubbleTextMine]}>{item.body}</Text>
                )}
                <Text style={[styles.bubbleTime, item.isMine && styles.bubbleTimeMine]}>{timeLabel(item.createdAt)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.hint}>No messages yet. Say hello.</Text>
            </View>
          }
        />
        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
        <View style={styles.composer}>
          {draft.trim() ? null : (
            <>
              <FileAttachmentButton threadId={threadId} onUploaded={sendFile} disabled={isSending} />
              <VoiceRecorderButton threadId={threadId} onUploaded={sendVoiceNote} disabled={isSending} />
            </>
          )}
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message"
            placeholderTextColor="#9AA5B1"
            multiline
          />
          {draft.trim() ? (
            <Pressable style={styles.sendButton} onPress={send} disabled={isSending || !draft.trim()}>
              <Ionicons name="send" size={18} color={colors.brand.foreground} />
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral.muted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  hint: { color: "#666", fontFamily: fonts.regular },
  error: { color: "#c62828", fontFamily: fonts.regular },
  errorBanner: { color: "#c62828", fontFamily: fonts.regular, fontSize: 12, textAlign: "center", paddingVertical: 4 },

  list: { padding: 16, gap: 8 },
  bubbleRow: { flexDirection: "row" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, gap: 2 },
  bubbleTheirs: { backgroundColor: "#fff", borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.brand.DEFAULT, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: fonts.regular, fontSize: 14.5, color: colors.neutral.foreground },
  bubbleTextMine: { color: colors.brand.foreground },
  bubbleTime: { fontFamily: fonts.regular, fontSize: 10, color: "#999", alignSelf: "flex-end" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.75)" },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    backgroundColor: colors.neutral.background,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
    fontFamily: fonts.regular,
    color: colors.neutral.foreground,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
});
