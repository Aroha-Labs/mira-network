import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import WalletCreation from '@/components/wallet/WalletCreation';

export default function SettingsScreen() {
  const { session } = useAuth();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');

  const userEmail = session?.user?.email;
  const userAvatar = session?.user?.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

  const SettingsItem = ({ icon, title, value, onPress }: any) => (
    <TouchableOpacity 
      style={[styles.settingsItem]} 
      onPress={onPress}
    >
      <View style={styles.settingsItemLeft}>
        <MaterialIcons name={icon} size={24} color={iconColor} style={styles.icon} />
        <Typography style={{ color: textColor }}>{title}</Typography>
      </View>
      <View style={styles.settingsItemRight}>
        {value && <Typography variant="caption" style={{ color: iconColor, marginRight: 8 }}>{value}</Typography>}
        <MaterialIcons name="chevron-right" size={24} color={iconColor} />
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView style={[styles.container, { backgroundColor }]}>
        <View style={styles.profileSection}>
          <Image source={{ uri: userAvatar }} style={styles.avatar} />
          <Typography variant="h2" style={{ color: textColor }}>{userEmail}</Typography>
        </View>

        <View style={styles.section}>
          <Typography variant="caption" style={[styles.sectionTitle, { color: iconColor }]}>Account</Typography>
          <SettingsItem icon="person" title="Profile" onPress={() => {}} />
          <SettingsItem icon="notifications" title="Notifications" onPress={() => {}} />
          <SettingsItem icon="security" title="Security" onPress={() => {}} />
        </View>

        <View style={styles.section}>
          <Typography variant="caption" style={[styles.sectionTitle, { color: iconColor }]}>Wallet</Typography>
          <WalletCreation />
        </View>

        <View style={styles.section}>
          <Typography variant="caption" style={[styles.sectionTitle, { color: iconColor }]}>Preferences</Typography>
          <SettingsItem icon="color-lens" title="Appearance" onPress={() => {}} />
          <SettingsItem icon="language" title="Language" value="English" onPress={() => {}} />
        </View>

        <View style={styles.section}>
          <Typography variant="caption" style={[styles.sectionTitle, { color: iconColor }]}>Support</Typography>
          <SettingsItem icon="help" title="Help Center" onPress={() => {}} />
          <SettingsItem icon="info" title="About" onPress={() => {}} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  createWalletButton: {
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createWalletText: {
    marginLeft: 8,
  },
  walletCreationSection: {
    padding: 16,
    marginHorizontal: 16,
    alignItems: 'center',
  },
});