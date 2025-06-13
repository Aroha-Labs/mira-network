// Contract address
export const CONTRACT_ADDRESS = "0xF621197B976bB9EE427fB087a39c4296692d7F70";

// ABI for contract
export const CONTRACT_ABI = [
    {
        inputs: [
            { internalType: "string", name: "appId", type: "string" },
            { internalType: "address[]", name: "userWallets", type: "address[]" },
            { internalType: "bytes32[]", name: "logHashes", type: "bytes32[]" },
        ],
        name: "submitBatchInferenceLogs",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            { internalType: "string", name: "appId", type: "string" },
            { internalType: "address", name: "userWallet", type: "address" },
            { internalType: "bytes32", name: "logHash", type: "bytes32" },
        ],
        name: "submitInferenceLog",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];

// Type for hex strings
export type oxs = `0x${string}`;

// Document interfaces
export interface InferenceLog {
    walletAddress: string;
    logId: string;
    processed?: boolean;
    "@timestamp"?: string;
} 
