import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CONTRACT_ABI, CONTRACT_ADDRESS, InferenceLog } from "../constants";
import { chain, config } from "../config/config";
import { createHash } from "crypto";

// Create wallet client
const account = privateKeyToAccount(config.blockchain.signerPrivateKey as `0x${string}`);
const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
});

/**
 * Create a hash from an inference log
 */
export function createLogHash(log: InferenceLog): `0x${string}` {
    const hash = createHash("sha256")
        .update(log.logId)
        .digest("hex");
    return `0x${hash}`;
}

/**
 * Submit a batch of inference logs to the blockchain
 */
export async function submitBatchInferenceLogs(logs: InferenceLog[]): Promise<string> {
    try {
        // Prepare data for contract call
        const userWallets = ["0x5A3b5E0F1A25Dd1948D186776c04df5e32332Ef2"];
        const logHashes = logs.map((log) => createLogHash(log));

        // Submit batch to blockchain
        const txHash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: "submitBatchInferenceLogs",
            args: [config.blockchain.appId, userWallets, logHashes],
        });

        console.info(`Batch submitted to blockchain, tx hash: ${txHash}`);
        return txHash;
    } catch (error) {
        console.error("Failed to submit batch to blockchain:", error);
        throw error;
    }
}

/**
 * Submit a single inference log to the blockchain
 */
export async function submitInferenceLog(log: InferenceLog): Promise<string> {
    try {
        const logHash = createLogHash(log);

        // Submit log to blockchain
        const txHash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: "submitInferenceLog",
            args: [config.blockchain.appId, "0x5A3b5E0F1A25Dd1948D186776c04df5e32332Ef2", logHash],
        });

        console.info(`Log submitted to blockchain, tx hash: ${txHash}`);
        return txHash;
    } catch (error) {
        console.error("Failed to submit log to blockchain:", error);
        throw error;
    }
} 