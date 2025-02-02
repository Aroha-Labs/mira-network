import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";

export interface UserMetadata {
  db_role: string;
  is_superuser: boolean;
  role: string;
}

interface JWTPayload {
  user_metadata: {
    db_role: string;
    is_active: boolean;
    is_superuser: boolean;
    // ... other metadata fields
  };
  role: string;
  // ... other JWT fields
}

// Add new interface for wallet login
interface WalletLoginParams {
  address: string;
  signature: string;
}

interface WalletAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user_id: string;
  wallet_address: string;
}

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Get current session with metadata
  const { data: session, isLoading: isLoadingSession } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;

      if (session) {
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        return refreshedSession;
      }

      return null;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Helper function to get user metadata by decoding JWT
  const getUserMetadata = (): UserMetadata => {
    if (!session?.access_token) {
      return {
        db_role: "free",
        is_superuser: false,
        role: "authenticated",
      };
    }

    try {
      const data = jwtDecode<{ user_roles?: ("admin" | "user")[] }>(
        session.access_token
      );
      const user_roles = data.user_roles || [];
      return {
        db_role: user_roles.includes("admin") ? "admin" : "user",
        is_superuser: user_roles.includes("admin"),
        role: "authenticated",
      };
    } catch (error) {
      console.error("Error decoding JWT:", error);
      return {
        db_role: "free",
        is_superuser: false,
        role: "authenticated",
      };
    }
  };

  // Simplified helper functions now that we know the structure
  const isAdmin = () => {
    try {
      const decoded = jwtDecode<JWTPayload>(session?.access_token ?? "");
      return decoded.user_metadata.is_superuser ?? false;
    } catch {
      return false;
    }
  };

  const getUserRole = () => {
    try {
      const decoded = jwtDecode<JWTPayload>(session?.access_token ?? "");
      return decoded.user_metadata.db_role ?? "free";
    } catch {
      return "free";
    }
  };

  const isActive = () => {
    try {
      const decoded = jwtDecode<JWTPayload>(session?.access_token ?? "");
      return decoded.user_metadata.is_active ?? false;
    } catch {
      return false;
    }
  };

  // Login mutation
  const {
    mutate: login,
    isPending: isLoggingIn,
    error: loginError,
  } = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      try {
        console.log("Attempting login for:", email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("Login error:", error);
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Invalid email or password");
          } else if (error.message.includes("Email not confirmed")) {
            throw new Error("Please verify your email before logging in");
          } else if (
            error.message.includes("Invalid type") ||
            error.message.includes("output claims")
          ) {
            // Handle the specific schema validation error
            console.error("Authentication schema error:", error);
            throw new Error(
              "Unable to authenticate. Please ensure your email is verified and try again."
            );
          } else {
            throw new Error(
              error.message ||
                "An error occurred during login. Please try again."
            );
          }
        }

        if (!data?.session) {
          throw new Error("Unable to create session. Please try again.");
        }

        // Add additional session validation
        if (!data.session.user?.id || !data.session.access_token) {
          console.error("Invalid session data:", data.session);
          throw new Error("Invalid session data received. Please try again.");
        }

        console.log("Login successful:", {
          user: data.session.user.email,
          aud: data.session.user.aud,
        });

        return data;
      } catch (error) {
        console.error("Login error in try-catch:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data?.session) {
        queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
        router.replace("/(app)/home");
      } else {
        throw new Error("Session creation failed");
      }
    },
    onError: (error: Error) => {
      console.error("Login error in onError:", error);
      alert(error.message);
    },
  });

  // Signup mutation
  const {
    mutate: signup,
    isPending: isSigningUp,
    error: signupError,
  } = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error("Signup error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data.user?.identities?.length === 0) {
        alert(
          "An account with this email already exists. Please sign in instead."
        );
        router.push("/(auth)/login");
        return;
      }

      router.push("/(auth)/login");
    },
    onError: (error: Error) => {
      console.error("Signup error:", error);
      alert(error.message);
    },
  });

  // Logout mutation
  const { mutate: logout, isPending: isLoggingOut } = useMutation({
    mutationFn: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error("Logout error:", error);
          throw error;
        }
      } catch (error) {
        console.error("Logout error in try-catch:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      router.replace("/(auth)/login");
    },
    onError: (error: Error) => {
      console.error("Logout error in onError:", error);
      alert("Error logging out. Please try again.");
    },
  });

  // google login
  const {
    mutate: googleLogin,
    isPending: googleLoading,
    error: googleLoginError,
  } = useMutation({
    mutationFn: async (idToken: string) => {
      try {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });
        if (error) throw error;
        return data;
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data?.session) {
        queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
        router.replace("/(app)/home");
      } else {
        throw new Error("Session creation failed");
      }
    },
    onError: (error: Error) => {
      console.error("Login error in onError:", error);
      alert(error.message);
    },
  });

  // Add wallet login mutation
  const {
    mutate: walletLogin,
    isPending: isWalletLoggingIn,
    error: walletLoginError,
  } = useMutation({
    mutationFn: async ({ address, signature }: WalletLoginParams) => {
      try {
        console.log("Initiating wallet login for address:", address);

        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/wallet/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ address, signature }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          console.error("Wallet login error response:", error);
          throw new Error(error.detail || "Failed to authenticate with wallet");
        }

        const authData: WalletAuthResponse = await response.json();
        console.log("Received auth response from backend");

        // Set the session in Supabase with complete session data
        const { data, error } = await supabase.auth.setSession({
          access_token: authData.access_token,
          refresh_token: authData.refresh_token,
        });

        console.log("Set session in Supabase:", data, error);

        if (error) {
          console.error("Supabase session error:", error);
          throw error;
        }

        return {
          session: data.session,
          wallet_address: authData.wallet_address,
        };
      } catch (error) {
        console.error("Wallet login process error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Wallet login successful:", data);
      if (!data?.session) {
        console.error("No session data after successful login");
        throw new Error("Session creation failed");
      }

      queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      router.replace("/(app)/home");
    },
    onError: (error: Error) => {
      console.error("Wallet login error:", error);
      alert(error.message || "Failed to login with wallet. Please try again.");
    },
  });

  return {
    session,
    isLoadingSession,
    isAdmin,
    getUserRole,
    isActive,
    getUserMetadata,
    login,
    isLoggingIn,
    loginError,
    signup,
    isSigningUp,
    signupError,
    logout,
    isLoggingOut,
    googleLogin,
    googleLoading,
    googleLoginError,
    walletLogin,
    isWalletLoggingIn,
    walletLoginError,
  };
}
