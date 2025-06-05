import { Chain } from "viem";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Environment variables with defaults
const {
    RPC_URL_HTTP = "https://rpc-test0-two-zepe2m25hg.t.conduit.xyz",
    RPC_URL_WS = "wss://rpc-test0-two-zepe2m25hg.t.conduit.xyz",
    SIGNER_PRIVATE_KEY,
    APP_ID = "Klok",
    BATCH_SIZE = "100",
} = process.env;

// Config validation
const requiredEnvVars = [
    "SIGNER_PRIVATE_KEY",
];

// Validate all required environment variables
export function validateConfig() {
    const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
    }
    console.info("Configuration validated successfully");
}

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
    },
};

// Chain configuration for viem
export const chain: Chain = {
    id: 48499,
    name: "voyager",
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