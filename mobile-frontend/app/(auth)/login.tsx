import { useState } from "react";
import { View, StyleSheet } from "react-native";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Typography from "@/components/ui/Typography";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { Session } from "@supabase/supabase-js";
import GoogleAuth from "@/components/Auth.native";
import WalletAuth from "@/components/WalletAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn, loginError } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      alert("Please enter both email and password");
      return;
    }
    login({ email: email.trim(), password });
  };

  return (
    <View style={styles.container}>
      <Card style={styles.formContainer}>
        <Typography variant="h1">Welcome Back</Typography>
        <Typography variant="h2">Sign in to continue</Typography>

        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoggingIn}
        />

        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoggingIn}
        />

        {loginError && (
          <Typography variant="caption" style={styles.errorText}>
            {loginError.message}
          </Typography>
        )}

        <Button
          title="Forgot Password?"
          variant="link"
          style={styles.forgotPassword}
          onPress={() => {}}
          disabled={isLoggingIn}
        />

        <Button
          title={isLoggingIn ? "Signing in..." : "Sign In"}
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={isLoggingIn}
        />

        <Typography variant="body" style={styles.dividerText}>
          Or continue with
        </Typography>

        <GoogleAuth />
        <WalletAuth />

        <View style={styles.signupContainer}>
          <Typography variant="caption" style={styles.signupText}>
            Don't have an account?{" "}
          </Typography>
          <Button
            title="Sign Up"
            variant="link"
            onPress={() => router.push("/(auth)/signup")}
            disabled={isLoggingIn}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  loginButton: {
    marginBottom: 20,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    marginRight: 4,
  },
  errorText: {
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 10,
  },
  dividerText: {
    color: "#666",
    textAlign: "center",
  },
});
