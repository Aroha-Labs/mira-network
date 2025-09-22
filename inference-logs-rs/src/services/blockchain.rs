use ethers::{
    abi::{Abi, AbiEncode},
    contract::Contract,
    core::types::{Address, Bytes, H256, TransactionRequest, U256},
    middleware::SignerMiddleware,
    providers::{Http, Middleware, Provider},
    signers::{LocalWallet, Signer},
    utils::keccak256,
};
use serde_json::json;
use sha3::{Digest, Keccak256};
use std::sync::Arc;

use crate::config::Config;
use crate::models::InferenceLog;

pub const CONTRACT_ADDRESS: &str = "0xF621197B976bB9EE427fB087a39c4296692d7F70";

pub const CONTRACT_ABI_JSON: &str = r#"[
    {
        "inputs": [
            { "internalType": "string", "name": "appId", "type": "string" },
            { "internalType": "address[]", "name": "userWallets", "type": "address[]" },
            { "internalType": "bytes32[]", "name": "logHashes", "type": "bytes32[]" }
        ],
        "name": "submitBatchInferenceLogs",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "appId", "type": "string" },
            { "internalType": "address", "name": "userWallet", "type": "address" },
            { "internalType": "bytes32", "name": "logHash", "type": "bytes32" }
        ],
        "name": "submitInferenceLog",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]"#;

pub struct BlockchainService {
    provider: Arc<SignerMiddleware<Provider<Http>, LocalWallet>>,
    contract: Contract<SignerMiddleware<Provider<Http>, LocalWallet>>,
    config: Config,
}

impl BlockchainService {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        let provider = Provider::<Http>::try_from(&config.rpc_url_http)?;

        let wallet: LocalWallet = config.signer_private_key
            .parse::<LocalWallet>()?
            .with_chain_id(provider.get_chainid().await?.as_u64());

        let provider = Arc::new(SignerMiddleware::new(provider, wallet));

        let contract_address: Address = CONTRACT_ADDRESS.parse()?;
        let abi: Abi = serde_json::from_str(CONTRACT_ABI_JSON)?;
        let contract = Contract::new(contract_address, abi, provider.clone());

        Ok(Self {
            provider,
            contract,
            config,
        })
    }

    fn hash_log(&self, log: &InferenceLog) -> H256 {
        let data = format!("{}{}", log.wallet_address, log.log_id);
        let mut hasher = Keccak256::new();
        hasher.update(data.as_bytes());
        let result = hasher.finalize();
        H256::from_slice(&result)
    }

    pub async fn submit_single_log(&self, log: &InferenceLog) -> Result<(), Box<dyn std::error::Error>> {
        let wallet_address: Address = log.wallet_address.parse()?;
        let log_hash = self.hash_log(log);

        let tx = self.contract
            .method::<_, ()>("submitInferenceLog", (
                self.config.app_id.clone(),
                wallet_address,
                log_hash,
            ))?
            .send()
            .await?
            .await?;

        tracing::info!("Single log submitted: {:?}", tx);
        Ok(())
    }

    pub async fn submit_batch_logs(&self, logs: Vec<InferenceLog>) -> Result<(), Box<dyn std::error::Error>> {
        if logs.is_empty() {
            return Ok(());
        }

        let mut user_wallets = Vec::new();
        let mut log_hashes = Vec::new();

        for log in &logs {
            let wallet_address: Address = log.wallet_address.parse()?;
            user_wallets.push(wallet_address);
            log_hashes.push(self.hash_log(log));
        }

        let chunks: Vec<_> = logs.chunks(self.config.batch_size).collect();

        for (i, chunk) in chunks.iter().enumerate() {
            let chunk_wallets: Vec<Address> = chunk
                .iter()
                .map(|log| log.wallet_address.parse())
                .collect::<Result<Vec<_>, _>>()?;

            let chunk_hashes: Vec<H256> = chunk
                .iter()
                .map(|log| self.hash_log(log))
                .collect();

            let tx = self.contract
                .method::<_, ()>("submitBatchInferenceLogs", (
                    self.config.app_id.clone(),
                    chunk_wallets,
                    chunk_hashes,
                ))?
                .send()
                .await?
                .await?;

            tracing::info!("Batch {} of {} submitted: {:?}", i + 1, chunks.len(), tx);
        }

        Ok(())
    }
}