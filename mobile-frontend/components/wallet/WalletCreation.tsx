import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import { useWallet } from '@/hooks/useWallet';
import { WalletInfo, WalletResponse } from '@/types/wallet';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function WalletCreation() {
  const [localWalletInfo, setLocalWalletInfo] = useState<WalletInfo | null>(null);
  const [importedMnemonic, setImportedMnemonic] = useState('');
  const [showImport, setShowImport] = useState(false);
  
  const { 
    createWallet, 
    isCreating, 
    isDownloading,
    downloadWalletInfo, 
    hasWallet,
    isLoading,
    walletInfo: existingWallet,
    walletError,
    refetchWallet,
    mnemonic,
    saveMnemonic,
    removeMnemonic,
    isSavingMnemonic,
    isRemovingMnemonic,
  } = useWallet();
  
  const iconColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');

  const handleCreateWallet = async () => {
    try {
      // Check if wallet already exists
      if (hasWallet) {
        Alert.alert('Error', 'You already have a wallet created.');
        return;
      }

      const newWallet = await createWallet();
      setLocalWalletInfo(newWallet);
      // Refresh wallet data
      await refetchWallet();
    } catch (error) {
      console.error('Error creating wallet:', error);
      Alert.alert('Error', 'Failed to create wallet. Please try again.');
    }
  };

  const handleImportWallet = async () => {
    if (!importedMnemonic.trim()) {
      Alert.alert('Error', 'Please enter your mnemonic phrase');
      return;
    }

    try {
      await saveMnemonic(importedMnemonic.trim());
      const newWallet = await createWallet();
      setLocalWalletInfo(newWallet);
      setImportedMnemonic('');
      setShowImport(false);
      await refetchWallet();
      Alert.alert('Success', 'Wallet imported successfully!');
    } catch (error) {
      console.error('Error importing wallet:', error);
      Alert.alert('Error', 'Failed to import wallet. Please check your mnemonic phrase and try again.');
    }
  };

  const handleResetWallet = async () => {
    Alert.alert(
      'Reset Wallet',
      'Are you sure you want to reset your wallet? This will remove your mnemonic phrase. Make sure you have backed it up!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMnemonic();
              setLocalWalletInfo(null);
              await refetchWallet();
              Alert.alert('Success', 'Wallet has been reset.');
            } catch (error) {
              console.error('Error resetting wallet:', error);
              Alert.alert('Error', 'Failed to reset wallet. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDownload = async () => {
    try {
      const storedMnemonic = mnemonic.data;
      if (!storedMnemonic || !existingWallet?.data) {
        Alert.alert('Error', 'Could not find wallet information');
        return;
      }

      // Combine backend wallet data with local mnemonic
      const fullWalletInfo: WalletResponse = {
        ...existingWallet.data,
        mnemonic: storedMnemonic
      };

      await downloadWalletInfo(fullWalletInfo);
      Alert.alert(
        'Success',
        'Please save your wallet information in a secure location. Never share your private key or mnemonic phrase with anyone.',
        [
          {
            text: 'I Have Saved It Securely',
            onPress: () => {
              setLocalWalletInfo(null);
              refetchWallet();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error 
          ? error.message 
          : 'Failed to share wallet information. Please try again.'
      );
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={tintColor} />
        <Typography style={{ color: textColor, marginTop: 16 }}>
          Checking wallet status...
        </Typography>
      </View>
    );
  }

  if (walletError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <MaterialIcons name="error" size={48} color={tintColor} />
        <Typography style={{ color: textColor, marginTop: 16 }}>
          Error loading wallet information
        </Typography>
        <Button 
          title="Try Again" 
          onPress={() => refetchWallet()}
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  if (isCreating) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={tintColor} />
        <Typography style={{ color: textColor, marginTop: 16 }}>
          Creating your wallet...
        </Typography>
      </View>
    );
  }

  if (localWalletInfo) {
    return (
      <View style={styles.container}>
        <View style={styles.infoContainer}>
          <Typography variant="h2" style={{ color: textColor }}>Wallet Created!</Typography>
          
          <View style={styles.addressContainer}>
            <Typography style={{ color: textColor }}>Address:</Typography>
            <Typography style={{ color: iconColor }}>{localWalletInfo.address}</Typography>
          </View>

          <View style={styles.warningContainer}>
            <MaterialIcons name="warning" size={24} color={tintColor} />
            <Typography style={[styles.warningText, { color: tintColor }]}>
              IMPORTANT: Download and securely store your wallet information. 
              It will only be shown once and cannot be recovered if lost.
            </Typography>
          </View>

          <Button
            title={isDownloading ? "Preparing Download..." : "Download Wallet Info"}
            onPress={handleDownload}
            disabled={isDownloading}
          />
        </View>
      </View>
    );
  }

  if (hasWallet && mnemonic.data) {
    return (
      <View style={styles.container}>
        <View style={styles.walletInfo}>
          <MaterialIcons name="account-balance-wallet" size={48} color={tintColor} />
          <Typography style={[styles.text, { color: textColor }]}>
            Wallet is set up and ready to use
          </Typography>
          <Typography variant="caption" style={[styles.address, { color: iconColor }]}>
            {existingWallet?.data?.address}
          </Typography>
        </View>
        <View style={styles.actions}>
          <Button 
            title="Download Backup" 
            onPress={handleDownload}
            loading={isDownloading}
            style={styles.button}
          />
          <Button 
            title="Reset Wallet" 
            onPress={handleResetWallet}
            loading={isRemovingMnemonic}
            variant="secondary"
            style={styles.button}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!showImport ? (
        <>
          <View style={styles.walletInfo}>
            <MaterialIcons name="account-balance-wallet" size={48} color={tintColor} />
            <Typography style={[styles.text, { color: textColor }]}>
              No wallet found
            </Typography>
            <Typography variant="caption" style={[styles.caption, { color: iconColor }]}>
              Create a new wallet or import an existing one
            </Typography>
          </View>
          <View style={styles.actions}>
            <Button
              title="Create New Wallet"
              onPress={handleCreateWallet}
              loading={isCreating}
              style={styles.button}
            />
            <Button
              title="Import Existing Wallet"
              onPress={() => setShowImport(true)}
              variant="secondary"
              style={styles.button}
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.walletInfo}>
            <MaterialIcons name="vpn-key" size={48} color={tintColor} />
            <Typography style={[styles.text, { color: textColor }]}>
              Import Existing Wallet
            </Typography>
            <Typography variant="caption" style={[styles.caption, { color: iconColor }]}>
              Enter your mnemonic phrase
            </Typography>
          </View>
          <TextInput
            style={[styles.input, { color: textColor, backgroundColor }]}
            placeholder="Enter mnemonic phrase..."
            placeholderTextColor={iconColor}
            value={importedMnemonic}
            onChangeText={setImportedMnemonic}
            multiline
            numberOfLines={3}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.actions}>
            <Button
              title="Import Wallet"
              onPress={handleImportWallet}
              loading={isSavingMnemonic}
              style={styles.button}
            />
            <Button
              title="Cancel"
              onPress={() => {
                setShowImport(false);
                setImportedMnemonic('');
              }}
              variant="secondary"
              style={styles.button}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  text: {
    marginTop: 16,
    textAlign: 'center',
  },
  caption: {
    marginTop: 8,
    textAlign: 'center',
  },
  address: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
  actions: {
    gap: 12,
  },
  button: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  infoContainer: {
    gap: 16,
  },
  addressContainer: {
    marginTop: 16,
    gap: 8,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginVertical: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
