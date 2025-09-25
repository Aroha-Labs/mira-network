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

pub const CONTRACT_ADDRESS: &str = "0x300bb1Aa41fF42aC005797c21300AcfE09d925a6";

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

        let wallet: LocalWallet = config
            .signer_private_key
            .parse::<LocalWallet>()?
            .with_chain_id(8453u64); // Base mainnet chain ID

        let provider = Arc::new(SignerMiddleware::new(provider, wallet));

        // Get wallet address and balance for logging
        let wallet_address = provider.address();
        let balance = provider.get_balance(wallet_address, None).await?;
        let balance_eth = balance.as_u128() as f64 / 1e18;

        tracing::info!("=== Base Mainnet Configuration ===");
        tracing::info!("Chain ID: 8453 (Base Mainnet)");
        tracing::info!("Signer wallet: {:?}", wallet_address);
        tracing::info!("Wallet balance: {} ETH ({} wei)", balance_eth, balance);
        tracing::info!("Contract address: {}", CONTRACT_ADDRESS);

        if balance_eth < 0.001 {
            tracing::warn!("⚠️  LOW BALANCE: Wallet has {:.6} ETH. Recommend at least 0.001 ETH for gas fees.", balance_eth);
            tracing::warn!("⚠️  Send Base ETH to wallet: {:?}", wallet_address);
        }

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

    pub async fn submit_single_log(
        &self,
        log: &InferenceLog,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Check balance before attempting transaction
        self.check_balance().await?;

        let wallet_address: Address = log.wallet_address.parse()?;
        let log_hash = self.hash_log(log);

        let contract_call = self
            .contract
            .method::<_, ()>(
                "submitInferenceLog",
                (self.config.app_id.clone(), wallet_address, log_hash),
            )?;

        // Estimate gas and add buffer
        let estimated_gas = contract_call.estimate_gas().await?;
        let gas_limit = estimated_gas * 120 / 100; // Add 20% buffer

        let tx_receipt = contract_call
            .gas(gas_limit)
            .send()
            .await?
            .await?
            .ok_or("Transaction receipt not found")?;

        let gas_used = tx_receipt.gas_used.unwrap_or_default();
        let effective_gas_price = tx_receipt.effective_gas_price.unwrap_or_default();
        let gas_fee_wei = gas_used * effective_gas_price;
        let gas_fee_eth = gas_fee_wei.as_u128() as f64 / 1e18;

        tracing::info!(
            "Single log submitted - TX: {:?}, Gas used: {}, Gas price: {} wei, Gas fee: {:.6} ETH",
            tx_receipt.transaction_hash,
            gas_used,
            effective_gas_price,
            gas_fee_eth
        );
        Ok(())
    }

    async fn check_balance(&self) -> Result<(), Box<dyn std::error::Error>> {
        let wallet_address = self.provider.address();
        let balance = self.provider.get_balance(wallet_address, None).await?;
        let balance_eth = balance.as_u128() as f64 / 1e18;

        if balance_eth < 0.0005 {
            return Err(format!(
                "Insufficient balance for gas fees. Wallet {:?} has {:.6} ETH, need at least 0.0005 ETH. Please send Base ETH to this address.",
                wallet_address, balance_eth
            ).into());
        }

        tracing::debug!("Balance check passed: {:.6} ETH available", balance_eth);
        Ok(())
    }

    pub async fn submit_batch_logs(
        &self,
        logs: Vec<InferenceLog>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if logs.is_empty() {
            return Ok(());
        }

        // Check balance before attempting transaction
        self.check_balance().await?;

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

            let chunk_hashes: Vec<H256> = chunk.iter().map(|log| self.hash_log(log)).collect();

            let contract_call = self
                .contract
                .method::<_, ()>(
                    "submitBatchInferenceLogs",
                    (self.config.app_id.clone(), chunk_wallets.clone(), chunk_hashes),
                )?;

            // Estimate gas and add buffer
            let estimated_gas = contract_call.estimate_gas().await?;
            let gas_limit = estimated_gas * 120 / 100; // Add 20% buffer

            tracing::info!(
                "Batch {} of {} - Logs: {}, Estimated gas: {}, Gas limit: {}",
                i + 1,
                chunks.len(),
                chunk.len(),
                estimated_gas,
                gas_limit
            );

            let tx_receipt = contract_call
                .gas(gas_limit)
                .send()
                .await?
                .await?
                .ok_or("Transaction receipt not found")?;

            let gas_used = tx_receipt.gas_used.unwrap_or_default();
            let effective_gas_price = tx_receipt.effective_gas_price.unwrap_or_default();
            let gas_fee_wei = gas_used * effective_gas_price;
            let gas_fee_eth = gas_fee_wei.as_u128() as f64 / 1e18;
            let logs_per_gas = if gas_used.is_zero() { 0.0 } else { chunk.len() as f64 / gas_used.as_u128() as f64 };

            tracing::info!(
                "Batch {} of {} submitted - TX: {:?}, Logs: {}, Gas used: {}, Gas price: {} wei, Gas fee: {:.6} ETH, Efficiency: {:.2} logs/gas",
                i + 1,
                chunks.len(),
                tx_receipt.transaction_hash,
                chunk.len(),
                gas_used,
                effective_gas_price,
                gas_fee_eth,
                logs_per_gas
            );
        }

        Ok(())
    }
}
