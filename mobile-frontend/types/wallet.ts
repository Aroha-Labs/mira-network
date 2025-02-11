import { HDAccount } from "viem";

export interface WalletInfo extends HDAccount {
  mnemonic?: string;
}

export interface EncryptedWalletInfo {
  address: string;
  encryptedData: string;
}

export interface WalletDownloadData {
  address: string;
  mnemonic: string;
  timestamp: string;
  warning: string;
}

export interface WalletResponse {
  address: string;
  chain: string;
  timestamp: string;
  id: string;
  mnemonic?: string;
}
