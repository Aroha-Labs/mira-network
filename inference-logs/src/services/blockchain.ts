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

// Configuration for rate limiting
const MAX_BATCH_SIZE = 100; // Maximum number of logs per batch to prevent rate limit errors
let lastSubmissionTime = 0;
const MIN_SUBMISSION_INTERVAL = 60000; // Minimum 1 minute between submissions

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
 * Sleep for a specified number of milliseconds
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Submit a batch of inference logs to the blockchain
 * Handles rate limiting by chunking large batches and adding delays
 */
export async function submitBatchInferenceLogs(logs: InferenceLog[]): Promise<string> {
    try {
        // If batch is too large, split it into smaller batches
        if (logs.length > MAX_BATCH_SIZE) {
            console.info(`Batch size ${logs.length} exceeds maximum of ${MAX_BATCH_SIZE}, splitting into smaller batches`);
            
            // Process in chunks of MAX_BATCH_SIZE
            const chunks = [];
            for (let i = 0; i < logs.length; i += MAX_BATCH_SIZE) {
                chunks.push(logs.slice(i, i + MAX_BATCH_SIZE));
            }
            
            let lastTxHash = '';
            
            // Process each chunk with a delay between submissions
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                console.info(`Processing chunk ${i+1}/${chunks.length} with ${chunk.length} logs`);
                
                // Wait for rate limit if needed
                const now = Date.now();
                const timeSinceLastSubmission = now - lastSubmissionTime;
                if (timeSinceLastSubmission < MIN_SUBMISSION_INTERVAL) {
                    const waitTime = MIN_SUBMISSION_INTERVAL - timeSinceLastSubmission;
                    console.info(`Rate limiting: waiting ${waitTime}ms before next submission`);
                    await sleep(waitTime);
                }
                
                // Submit this chunk
                lastTxHash = await submitSingleBatch(chunk);
                lastSubmissionTime = Date.now();
                
                // If not the last chunk, add a delay
                if (i < chunks.length - 1) {
                    console.info('Adding delay between batch submissions');
                    await sleep(MIN_SUBMISSION_INTERVAL);
                }
            }
            
            return lastTxHash;
        } else {
            // Wait for rate limit if needed
            const now = Date.now();
            const timeSinceLastSubmission = now - lastSubmissionTime;
            if (timeSinceLastSubmission < MIN_SUBMISSION_INTERVAL) {
                const waitTime = MIN_SUBMISSION_INTERVAL - timeSinceLastSubmission;
                console.info(`Rate limiting: waiting ${waitTime}ms before submission`);
                await sleep(waitTime);
            }
            
            // Small enough batch, submit directly
            const txHash = await submitSingleBatch(logs);
            lastSubmissionTime = Date.now();
            return txHash;
        }
    } catch (error) {
        console.error("Failed to submit batch to blockchain:", error);
        throw error;
    }
}

/**
 * Submit a single batch of logs (helper function)
 */
async function submitSingleBatch(logs: InferenceLog[]): Promise<string> {
    // Prepare data for contract call
    const logHashes = logs.map((log) => createLogHash(log));
    
    // Create an array of user wallets that matches the length of logHashes
    // If logs have wallet addresses, use them, otherwise use the default address
    const userWallets = logs.map((log) => 
        (log.walletAddress && log.walletAddress.startsWith('0x')) 
            ? log.walletAddress as `0x${string}` 
            : "0x5A3b5E0F1A25Dd1948D186776c04df5e32332Ef2"
    );
    
    console.info(`Submitting batch of ${logs.length} logs to blockchain`);
    console.info(`User wallets array length: ${userWallets.length}, Log hashes array length: ${logHashes.length}`);

    // Submit batch to blockchain
    const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: "submitBatchInferenceLogs",
        args: [config.blockchain.appId, userWallets, logHashes],
    });

    console.info(`Batch submitted to blockchain, tx hash: ${txHash}`);
    return txHash;
}

/**
 * Submit a single inference log to the blockchain
 */
export async function submitInferenceLog(log: InferenceLog): Promise<string> {
    try {
        // Wait for rate limit if needed
        const now = Date.now();
        const timeSinceLastSubmission = now - lastSubmissionTime;
        if (timeSinceLastSubmission < MIN_SUBMISSION_INTERVAL) {
            const waitTime = MIN_SUBMISSION_INTERVAL - timeSinceLastSubmission;
            console.info(`Rate limiting: waiting ${waitTime}ms before submission`);
            await sleep(waitTime);
        }
        
        const logHash = createLogHash(log);
        
        // Use the log's wallet address if available, otherwise use default
        const userWallet = (log.walletAddress && log.walletAddress.startsWith('0x')) 
            ? log.walletAddress as `0x${string}`
            : "0x5A3b5E0F1A25Dd1948D186776c04df5e32332Ef2";

        // Submit log to blockchain
        const txHash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: "submitInferenceLog",
            args: [config.blockchain.appId, userWallet, logHash],
        });

        console.info(`Log submitted to blockchain, tx hash: ${txHash}`);
        lastSubmissionTime = Date.now();
        return txHash;
    } catch (error) {
        console.error("Failed to submit log to blockchain:", error);
        throw error;
    }
} 
