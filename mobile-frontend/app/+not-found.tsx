import { Link, Stack, useRouter } from "expo-router";
import { StyleSheet, Pressable } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import Typography from "@/components/ui/Typography";

export default function NotFoundScreen() {
  const router = useRouter();

  const handleNavigate = () => {
    console.log('Attempting to navigate to home...');
    try {
      // Navigate to the home screen inside the (app) group
      router.push('/(app)/home');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <ThemedView style={styles.container}>
        <Typography variant="h1">Not Found</Typography>
        <Typography variant="h2">
          The page you're looking for doesn't exist.
        </Typography>
        <Pressable onPress={handleNavigate} style={styles.link}>
          <Typography variant="body" style={styles.linkText}>Go back home</Typography>
        </Pressable>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  link: {
    marginTop: 15,
    padding: 10,
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});
