import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Animated,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Message } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";
import Markdown from "react-native-markdown-display";

const MESSAGES_PER_PAGE = 50;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollViewRef = useRef<ScrollView>(null);
  const [message, setMessage] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isNewChat = id === "new";

  // Fetch messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", id],
    queryFn: () =>
      api.chat.listMessages(session?.access_token, id).then((res) => res.data),
    enabled: !!session?.access_token && !isNewChat && id !== "new",
  });

  // Fetch thread details
  const { data: thread } = useQuery({
    queryKey: ["thread", id],
    queryFn: () =>
      api.chat.getThread(session?.access_token, id).then((res) => res.data),
    enabled: !!session?.access_token && !isNewChat && id !== "new",
  });

  // Send message mutation
  const { mutate: sendMessage, isLoading: isSending } = useMutation({
    mutationFn: async (content: string) => {
      if (!session?.access_token) throw new Error("No token");

      // Create temporary IDs for optimistic updates
      const tempMessageId = "temp-user-" + Date.now();
      const tempThreadId = isNewChat ? "temp-thread-" + Date.now() : id;

      // Optimistically add user message to the UI
      const optimisticUserMessage = {
        id: tempMessageId,
        role: "user" as const,
        content,
        created_at: new Date().toISOString(),
        thread_id: tempThreadId,
        message_metadata: {},
      };

      // Update messages cache with optimistic user message
      queryClient.setQueryData(
        ["messages", isNewChat ? tempThreadId : id],
        (old: Message[] = []) => [...old, optimisticUserMessage]
      );

      setStreaming(true);
      setStreamedContent("");
      let accumulatedContent = "";
      let responseThreadId: string | undefined;

      try {
        console.log("Starting streaming message...");
        const response = await api.chat.createStreamingMessage(
          session.access_token,
          {
            content,
            thread_id: isNewChat ? undefined : id,
            model: "gpt-4o",
            stream: true,
          },
          (chunk) => {
            console.log("Received chunk:", chunk);
            accumulatedContent += chunk;
            setStreamedContent(accumulatedContent);
            // Scroll to bottom as content streams in
            scrollViewRef.current?.scrollToEnd({ animated: true });
            // delay of .5 seconds
            setTimeout(() => {
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }).start();
            }, 500);
          }
        );

        console.log("Stream complete, response:", response);
        responseThreadId = response?.data?.thread_id;
        console.log("Thread ID from response:", responseThreadId);

        if (isNewChat && responseThreadId) {
          // For new chats:
          // 1. Create messages array with proper thread ID
          const messages = [
            {
              ...optimisticUserMessage,
              thread_id: responseThreadId,
            },
            {
              id: "temp-assistant-" + Date.now(),
              role: "assistant",
              content: accumulatedContent,
              created_at: new Date().toISOString(),
              thread_id: responseThreadId,
              message_metadata: {},
            },
          ];

          // 2. Set up the new thread's messages
          queryClient.setQueryData(["messages", responseThreadId], messages);

          // 3. Invalidate the threads list to show the new thread
          queryClient.invalidateQueries({ queryKey: ["threads"] });

          // 4. Navigate to the new thread
          // Use replace to prevent going back to the "new" chat
          router.replace(`/chat/${responseThreadId}`);
        } else {
          // For existing chats, just add the AI response
          queryClient.setQueryData(["messages", id], (old: Message[] = []) => [
            ...old,
            {
              id: "temp-assistant-" + Date.now(),
              role: "assistant",
              content: accumulatedContent,
              created_at: new Date().toISOString(),
              thread_id: id,
              message_metadata: {},
            },
          ]);
        }

        return response;
      } catch (error) {
        console.error("Error in streaming message:", error);
        // Clean up optimistic updates on error
        if (isNewChat) {
          queryClient.setQueryData(["messages", tempThreadId], []);
        } else {
          // Revert the optimistic update for the current thread
          queryClient.setQueryData(
            ["messages", id],
            (old: Message[] = []) =>
              old?.filter((msg) => msg.id !== tempMessageId) || []
          );
        }
        throw error;
      } finally {
        setStreaming(false);
        setStreamedContent("");
        fadeAnim.setValue(0);

        // Only invalidate queries for the current thread ID
        const currentThreadId = isNewChat ? responseThreadId : id;
        if (currentThreadId) {
          queryClient.invalidateQueries({
            queryKey: ["messages", currentThreadId],
          });
        }
      }
    },
    onSuccess: () => {
      setMessage("");
      scrollViewRef.current?.scrollToEnd({ animated: true });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    },
  });

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const renderMessage = (msg: Message) => (
    <Animated.View
      key={msg.id}
      style={[
        styles.messageRow,
        msg.role === "user"
          ? styles.userMessageRow
          : styles.assistantMessageRow,
      ]}
    >
      {msg.role === "assistant" && (
        <View style={styles.avatar}>
          <MaterialCommunityIcons
            name="robot"
            size={24}
            color="#0066cc"
            style={styles.avatarIcon}
          />
        </View>
      )}
      <View
        style={[
          styles.messageContainer,
          msg.role === "user" ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        <Markdown
          style={msg.role === "user" ? markdownStylesUser : markdownStyles}
        >
          {msg.content}
        </Markdown>
        <Text
          style={[
            styles.timestamp,
            msg.role === "user"
              ? styles.userTimestamp
              : styles.assistantTimestamp,
          ]}
        >
          {new Date(msg.created_at).toLocaleTimeString()}
        </Text>
      </View>
      {msg.role === "user" && (
        <View style={styles.avatar}>
          <MaterialCommunityIcons
            name="account-circle"
            size={24}
            color="#0066cc"
            style={styles.avatarIcon}
          />
        </View>
      )}
    </Animated.View>
  );

  if (isLoading && !isNewChat) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {isNewChat ? "New Chat" : thread?.title || "Chat"}
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {isNewChat ? (
          <View style={styles.newChatContainer}>
            <MaterialCommunityIcons
              name="chat-plus"
              size={48}
              color="#0066cc"
            />
            <Text style={styles.newChatTitle}>Start a New Chat</Text>
            <Text style={styles.newChatSubtitle}>
              Type your message below to begin a conversation
            </Text>
          </View>
        ) : (
          messages?.map(renderMessage)
        )}
        {streaming && streamedContent && (
          <Animated.View
            style={[styles.messageRow, styles.assistantMessageRow]}
          >
            <View style={styles.avatar}>
              <MaterialCommunityIcons
                name="robot"
                size={24}
                color="#0066cc"
                style={styles.avatarIcon}
              />
            </View>
            <View
              style={[
                styles.messageContainer,
                styles.assistantMessage,
                { opacity: fadeAnim },
              ]}
            >
              <Markdown style={markdownStyles}>{streamedContent}</Markdown>
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color="#0066cc" />
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          multiline
          maxHeight={100}
          editable={!streaming}
        />
        <Pressable
          onPress={() => message.trim() && sendMessage(message.trim())}
          disabled={!message.trim() || isSending || streaming}
          style={({ pressed }) => [
            styles.sendButton,
            pressed && { opacity: 0.7 },
            (!message.trim() || isSending || streaming) &&
              styles.sendButtonDisabled,
          ]}
        >
          {streaming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons
              name="send"
              size={24}
              color={!message.trim() || isSending ? "#999" : "#fff"}
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 8,
  },
  userMessageRow: {
    justifyContent: "flex-end",
  },
  assistantMessageRow: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  avatarIcon: {
    backgroundColor: "transparent",
  },
  messageContainer: {
    padding: 12,
    borderRadius: 12,
    maxWidth: "75%",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  userMessage: {
    backgroundColor: "#0066cc",
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  userTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  assistantTimestamp: {
    color: "#999",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  input: {
    flex: 1,
    marginRight: 12,
    padding: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 20,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    backgroundColor: "#0066cc",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#e0e0e0",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  newChatContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    minHeight: 300,
  },
  newChatTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
    textAlign: "center",
  },
  newChatSubtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  typingIndicator: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
});

const markdownStylesUser = {
  body: {
    color: "#fff",
  },
  code_inline: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#fff",
    padding: 4,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#fff",
    padding: 8,
    borderRadius: 4,
    marginVertical: 8,
  },
  link: {
    color: "#fff",
    textDecorationLine: "underline",
  },
};

const markdownStyles = {
  body: {
    color: "#333",
  },
  code_inline: {
    backgroundColor: "#f0f0f0",
    padding: 4,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: "#f0f0f0",
    padding: 8,
    borderRadius: 4,
    marginVertical: 8,
  },
  link: {
    color: "#0066cc",
  },
};
