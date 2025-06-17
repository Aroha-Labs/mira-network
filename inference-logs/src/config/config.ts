import { Chain } from "viem";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Environment variables with defaults
const {
  // Voyager appchain RPC endpoints from Coinbase Developer Platform
  RPC_URL_HTTP = "https://voyager-auth-rpc-testnet.appchain.base.org/faPiPRqAL4atStDoWt83EFXOcZS2kaXJ",
  RPC_URL_WS = "wss://voyager-auth-rpc-testnet.appchain.base.org/faPiPRqAL4atStDoWt83EFXOcZS2kaXJ",
  SIGNER_PRIVATE_KEY,
  APP_ID = "Klok",
  BATCH_SIZE = "100",
  // Gas settings in wei (1 gwei = 1e9 wei)
  // MAX_FEE_PER_GAS = "1000000000", // 1 gwei in wei
  // MAX_PRIORITY_FEE_PER_GAS = "1000000000", // 1 gwei in wei
} = process.env;

// Config validation
// const requiredEnvVars = [
//     "SIGNER_PRIVATE_KEY",
// ];

// Convert string values to appropriate types
export const config = {
  webhook: {
    batchSize: parseInt(BATCH_SIZE, 10),
  },
  blockchain: {
    appId: APP_ID,
    signerPrivateKey: SIGNER_PRIVATE_KEY!,
    rpcUrlHttp: RPC_URL_HTTP,
    rpcUrlWs: RPC_URL_WS,
    // maxFeePerGas: BigInt(MAX_FEE_PER_GAS),
    // maxPriorityFeePerGas: BigInt(MAX_PRIORITY_FEE_PER_GAS),
  },
};

// Chain configuration for viem
export const chain: Chain = {
  id: 8453200019, // Voyager testnet chain ID
  name: "Voyager Testnet",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.blockchain.rpcUrlHttp],
      // webSocket: [config.blockchain.rpcUrlWs],
    },
  },
};

