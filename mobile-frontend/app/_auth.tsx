import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';

// This hook will protect the route access based on user authentication
function useProtectedRoute(isLoggedIn: boolean | null) {
  const segments = useSegments();
  const router = useRouter();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    if (!isNavigationReady) {
      setIsNavigationReady(true);
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (isLoggedIn === false && !inAuthGroup) {
      // Redirect to the sign-in page
      router.replace('/(auth)/login');
    } else if (isLoggedIn === true && inAuthGroup) {
      // Redirect to the home page
      router.replace('/(app)/home');
    }
  }, [isLoggedIn, segments, isNavigationReady]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoadingSession } = useAuth();
  const isLoggedIn = isLoadingSession ? null : !!session;
  useProtectedRoute(isLoggedIn);

  if (isLoadingSession) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return children;
}
