import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { signup, isSigningUp } = useAuth();
  const router = useRouter();

  const handleSignup = () => {
    if (password !== confirmPassword) {
      // You might want to add proper error handling here
      alert("Passwords don't match");
      return;
    }
    signup({ email, password });
  };

  return (
    <View style={styles.container}>
      <Card style={styles.formContainer}>
        <Typography variant="h1">Create Account</Typography>
        <Typography variant="h2">Sign up to get started</Typography>
        
        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isSigningUp}
        />

        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isSigningUp}
        />

        <Input
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!isSigningUp}
        />

        <Button
          title={isSigningUp ? "Creating Account..." : "Create Account"}
          style={styles.signupButton}
          onPress={handleSignup}
          disabled={isSigningUp}
        />

        <View style={styles.loginContainer}>
          <Typography variant="caption" style={styles.loginText}>
            Already have an account?{' '}
          </Typography>
          <Button
            title="Sign In"
            variant="link"
            onPress={() => router.push('/(auth)/login')}
            disabled={isSigningUp}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  signupButton: {
    marginBottom: 20,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    marginRight: 4,
  },
});
