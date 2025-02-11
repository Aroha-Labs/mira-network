import { View, StyleSheet, ScrollView } from 'react-native';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function HomePage() {
  const { logout, session, isAdmin, getUserRole, getUserMetadata } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <Typography variant="h1">Welcome!</Typography>
      <Typography variant="h2" style={styles.email}>
        {session?.user?.email}
      </Typography>

      <View style={styles.content}>
        <Typography variant="body" style={styles.text}>
          You're now logged in as a {getUserMetadata().db_role} user
          {isAdmin() ? ' (Admin)' : ''}
          . This is a protected route that only authenticated users can access.
        </Typography>
      </View>

      <Button
        title="Logout"
        onPress={() => logout()}
        style={styles.logoutButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  email: {
    marginBottom: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
    marginBottom: 20,
  },
  logoutButton: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 20,
  },
});
