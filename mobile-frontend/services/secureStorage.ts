import * as SecureStore from 'expo-secure-store';

export enum SecureStorageKeys {
  WALLET_MNEMONIC = 'wallet_mnemonic',
}

export class SecureStorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SecureStorageError';
  }
}

export class SecureStorageService {
  private static instance: SecureStorageService;

  private constructor() {}

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  async saveSecureItem(key: SecureStorageKeys, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      throw new SecureStorageError(`Failed to save secure item: ${key}`, error);
    }
  }

  async getSecureItem(key: SecureStorageKeys): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      throw new SecureStorageError(`Failed to retrieve secure item: ${key}`, error);
    }
  }

  async removeSecureItem(key: SecureStorageKeys): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      throw new SecureStorageError(`Failed to remove secure item: ${key}`, error);
    }
  }
}

export const secureStorageService = SecureStorageService.getInstance();
