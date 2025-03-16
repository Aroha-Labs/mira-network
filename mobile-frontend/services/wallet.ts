import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import { WalletInfo, WalletDownloadData, WalletResponse } from "@/types/wallet";
import "react-native-get-random-values"
import { mnemonicToAccount, generateMnemonic, english } from "viem/accounts";
import { secureStorageService, SecureStorageKeys } from "./secureStorage";

class WalletService {
  private static instance: WalletService;

  private constructor() {}

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  /**
   * Creates a new wallet or loads an existing one.
   * If a mnemonic already exists in secure storage, it will load that instead of creating a new one.
   * @returns WalletInfo containing the account details and mnemonic
   * @throws Error if wallet creation or loading fails
   */
  async createWallet(): Promise<WalletInfo> {
    try {
      // Check if we already have a stored mnemonic
      const existingMnemonic = await this.getMnemonic();
      
      // Use existing mnemonic if available, otherwise generate new one
      const mnemonic = existingMnemonic || generateMnemonic(english);
      
      // If this is a new mnemonic, save it
      if (!existingMnemonic) {
        await secureStorageService.saveSecureItem(SecureStorageKeys.WALLET_MNEMONIC, mnemonic);
      }

      // Create a wallet from the mnemonic
      const account = mnemonicToAccount(mnemonic);

      return {
        ...account,
        mnemonic: mnemonic,
      };
    } catch (error) {
      console.error("Error creating/loading wallet:", error);
      throw new Error("Failed to create/load wallet");
    }
  }

  /**
   * Retrieves the stored mnemonic phrase from secure storage.
   * @returns The mnemonic phrase if found, null otherwise
   * @throws Error if retrieval fails
   */
  async getMnemonic(): Promise<string | null> {
    try {
      return await secureStorageService.getSecureItem(SecureStorageKeys.WALLET_MNEMONIC);
    } catch (error) {
      console.error("Error retrieving mnemonic:", error);
      throw new Error("Failed to retrieve mnemonic");
    }
  }

  /**
   * Saves a mnemonic phrase to secure storage.
   * Use this when importing an existing wallet.
   * @param mnemonic The mnemonic phrase to save
   * @throws Error if saving fails
   */
  async saveMnemonic(mnemonic: string): Promise<void> {
    try {
      await secureStorageService.saveSecureItem(SecureStorageKeys.WALLET_MNEMONIC, mnemonic);
    } catch (error) {
      console.error("Error saving mnemonic:", error);
      throw new Error("Failed to save mnemonic");
    }
  }

  /**
   * Removes the stored mnemonic from secure storage.
   * Use this for wallet deletion/reset.
   * @throws Error if removal fails
   */
  async removeMnemonic(): Promise<void> {
    try {
      await secureStorageService.removeSecureItem(SecureStorageKeys.WALLET_MNEMONIC);
    } catch (error) {
      console.error("Error removing mnemonic:", error);
      throw new Error("Failed to remove mnemonic");
    }
  }

  async encryptWalletData(data: string, password: string): Promise<string> {
    try {
      // Create a unique salt for this encryption
      const salt = await Crypto.getRandomBytesAsync(16);

      // Create a composite key using password and salt
      const compositeKey = password + Buffer.from(salt).toString("hex");

      // Generate a hash of the composite key
      const keyHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        compositeKey
      );

      // Generate an initialization vector (IV)
      const iv = await Crypto.getRandomBytesAsync(16);

      // Create final encryption key by combining keyHash with IV
      const encryptionKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        keyHash + Buffer.from(iv).toString("hex")
      );

      // Encrypt the data using the encryption key
      const encryptedData = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA512,
        data + encryptionKey
      );

      // Return encrypted data with salt and IV
      return JSON.stringify({
        version: "1",
        salt: Buffer.from(salt).toString("base64"),
        iv: Buffer.from(iv).toString("base64"),
        data: encryptedData,
      });
    } catch (error) {
      console.error("Error encrypting wallet data:", error);
      throw new Error("Failed to encrypt wallet data");
    }
  }

  async generateWalletDownloadFile(walletInfo: WalletResponse): Promise<string> {
    try {
      const downloadData: WalletDownloadData = {
        address: walletInfo.address,
        mnemonic: walletInfo.mnemonic || "",
        timestamp: new Date().toISOString(),
        warning:
          "KEEP THIS INFORMATION SECURE AND PRIVATE. NEVER SHARE IT WITH ANYONE.",
      };

      const fileName = `wallet-${downloadData.address.slice(0, 8)}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(downloadData, null, 2),
        {
          encoding: FileSystem.EncodingType.UTF8,
        }
      );

      return filePath;
    } catch (error) {
      console.error("Error generating wallet file:", error);
      throw new Error("Failed to generate wallet file");
    }
  }
}

export const walletService = WalletService.getInstance();
