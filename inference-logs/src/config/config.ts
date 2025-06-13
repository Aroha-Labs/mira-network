import { Chain } from "viem";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Environment variables with defaults
const {
    // Base Sepolia testnet RPC endpoints
    RPC_URL_HTTP = "https://sepolia.base.org",
    RPC_URL_WS = "wss://sepolia.base.org",
    SIGNER_PRIVATE_KEY,
    APP_ID = "Klok",
    BATCH_SIZE = "100",
    // Gas settings in wei (1 gwei = 1e9 wei)
    // MAX_FEE_PER_GAS = "1000000", // 0.001 gwei in wei
    // MAX_PRIORITY_FEE_PER_GAS = "1000000", // 0.001 gwei in wei
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
    id: 84532, // Base Sepolia testnet chain ID
    name: "Base Sepolia",
    nativeCurrency: {
        name: "ETH",
        symbol: "ETH",
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: [config.blockchain.rpcUrlHttp],
            webSocket: [config.blockchain.rpcUrlWs],
        },
    },
};

