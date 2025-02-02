import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { walletService } from '@/services/wallet';
import { WalletInfo, WalletResponse } from '@/types/wallet';
import { useAuth } from './useAuth';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { api } from '@/utils/api';

export function useWallet() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);

  const getWalletInfo = useQuery<WalletResponse | null>({
    queryKey: ['wallet'],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error('User must be logged in to view wallet information');
      }
      try {
        const wallet = await api.wallet.getWallet(session.access_token);
        return wallet;
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const createWalletMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error('User must be logged in to create a wallet');
      }

      // Create a new wallet using ethers.js
      const walletInfo = await walletService.createWallet();

      // Register wallet with the API
      await api.wallet.createWallet(
        session.access_token,
        walletInfo.address,
        'ethereum', // or get this from config/env
      );

      return walletInfo;
    },
  });

  const downloadWalletInfo = async (walletInfo: WalletResponse) => {
    try {
      setIsDownloading(true);
      
      // Generate the wallet file
      const filePath = await walletService.generateWalletDownloadFile(walletInfo);
      
      // Check if sharing is available on the device
      const isSharingAvailable = await Sharing.isAvailableAsync();
      
      if (isSharingAvailable) {
        // Share the file
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Save Wallet Information',
          UTI: 'public.json', // Uniform Type Identifier for iOS
        });
        
        // Delete the temporary file after sharing
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        
        return true;
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing wallet info:', error);
      throw error;
    } finally {
      setIsDownloading(false);
    }
  };

  const getMnemonicQuery = useQuery({
    queryKey: ['wallet-mnemonic'],
    queryFn: async () => {
      const data = await walletService.getMnemonic();
      return data;
    },
    enabled: !!session?.access_token,
  });

  const saveMnemonicMutation = useMutation({
    mutationFn: async (mnemonic: string) => {
      await walletService.saveMnemonic(mnemonic);
      // Invalidate the mnemonic query to trigger a refresh
      queryClient.invalidateQueries({ queryKey: ['wallet-mnemonic'] });
    },
  });

  const removeMnemonicMutation = useMutation({
    mutationFn: async () => {
      await walletService.removeMnemonic();
      // Invalidate the mnemonic query to trigger a refresh
      queryClient.invalidateQueries({ queryKey: ['wallet-mnemonic'] });
    },
  });

  return {
    createWallet: createWalletMutation.mutateAsync,
    isCreating: createWalletMutation.isPending,
    isDownloading,
    downloadWalletInfo,
    walletInfo: getWalletInfo,
    isLoading: getWalletInfo.isLoading,
    walletError: getWalletInfo.error,
    hasWallet: !!getWalletInfo.data,
    refetchWallet: () => queryClient.invalidateQueries({ queryKey: ['wallet'] }),
    mnemonic: {
      data: getMnemonicQuery.data,
      isLoading: getMnemonicQuery.isLoading,
      error: getMnemonicQuery.error,
    },
    saveMnemonic: saveMnemonicMutation.mutate,
    removeMnemonic: removeMnemonicMutation.mutate,
    isSavingMnemonic: saveMnemonicMutation.isPending,
    isRemovingMnemonic: removeMnemonicMutation.isPending,
  };
}
