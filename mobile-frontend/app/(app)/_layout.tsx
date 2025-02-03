import { Stack } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Text, Pressable, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, useRef } from "react";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Thread } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";

function CustomDrawerContent(props: any) {
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Fetch threads
  const { data: threadsResponse, isLoading } = useQuery({
    queryKey: ["threads"],
    queryFn: () => api.chat.listThreads(session?.access_token as string),
    enabled: !!session?.access_token,
  });

  const threads = threadsResponse?.data || [];

  // Create new thread mutation
  const { mutate: createThread } = useMutation({
    mutationFn: async () => {
      router.push(`/chat/new`);
    },
  });

  const toggleChat = () => {
    setIsChatExpanded(!isChatExpanded);
    Animated.spring(rotateAnim, {
      toValue: isChatExpanded ? 0 : 1,
      useNativeDriver: true,
    }).start();
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const navigateToThread = (threadId: string) => {
    router.push(`/chat/${threadId}`);
  };

  return (
    <View style={{ flex: 1, paddingTop: 20 }}>
      {/* Home Item */}
      <Pressable
        onPress={() => router.push("/home")}
        style={({ pressed }) => ({
          backgroundColor: pressed ? "#f0f0f0" : "#fff",
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
        })}
      >
        <MaterialCommunityIcons
          name="home"
          size={24}
          color="#666"
          style={{ marginRight: 12 }}
        />
        <Text style={{ fontSize: 16, color: "#333" }}>Home</Text>
      </Pressable>

      {/* Chat Section */}
      <View>
        <Pressable
          onPress={toggleChat}
          style={({ pressed }) => ({
            backgroundColor: pressed ? "#f0f0f0" : "#fff",
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: "#eee",
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MaterialCommunityIcons
              name="chat"
              size={24}
              color="#666"
              style={{ marginRight: 12 }}
            />
            <Text style={{ fontSize: 16, color: "#333" }}>Chat</Text>
          </View>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <MaterialCommunityIcons
              name="chevron-down"
              size={24}
              color="#666"
            />
          </Animated.View>
        </Pressable>

        {isChatExpanded && (
          <View style={{ backgroundColor: "#f8f8f8" }}>
            {/* New Chat Button */}
            <Pressable
              onPress={() => createThread()}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#005cb2" : "#0066cc",
                padding: 12,
                margin: 8,
                borderRadius: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <MaterialCommunityIcons
                name="plus"
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontSize: 14, color: "#fff", fontWeight: "600" }}>
                New Chat
              </Text>
            </Pressable>

            {isLoading ? (
              <View
                style={{
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#666" }}>Loading threads...</Text>
              </View>
            ) : threads.length === 0 ? (
              <View
                style={{
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#666" }}>No chats yet</Text>
              </View>
            ) : (
              threads.map((thread) => (
                <Pressable
                  key={thread.id}
                  onPress={() => navigateToThread(thread.id)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? "#eee" : "#f8f8f8",
                    padding: 16,
                    paddingLeft: 52,
                    borderBottomWidth: 1,
                    borderBottomColor: "#eee",
                    flexDirection: "row",
                    alignItems: "center",
                  })}
                >
                  <MaterialCommunityIcons
                    name="chat-outline"
                    size={20}
                    color="#666"
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 14, color: "#333" }}
                      numberOfLines={1}
                    >
                      {thread.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#666" }}>
                      {new Date(thread.updated_at).toLocaleDateString()}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      {/* Settings Item */}
      <Pressable
        onPress={() => router.push("/settings")}
        style={({ pressed }) => ({
          backgroundColor: pressed ? "#f0f0f0" : "#fff",
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
        })}
      >
        <MaterialCommunityIcons
          name="cog"
          size={24}
          color="#666"
          style={{ marginRight: 12 }}
        />
        <Text style={{ fontSize: 16, color: "#333" }}>Settings</Text>
      </Pressable>
    </View>
  );
}

export default function AppLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerStyle: {
            backgroundColor: "#f5f5f5",
          },
          headerTintColor: "#333",
          drawerStyle: {
            backgroundColor: "#fff",
            width: 320,
          },
        }}
        drawerContent={(props) => <CustomDrawerContent {...props} />}
      >
        <Drawer.Screen
          name="home"
          options={{
            title: "Home",
          }}
        />
        <Drawer.Screen
          name="chat/[id]"
          options={{
            title: "Chat",
          }}
        />
        <Drawer.Screen
          name="settings"
          options={{
            title: "Settings",
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
