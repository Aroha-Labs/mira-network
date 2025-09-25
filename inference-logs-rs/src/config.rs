use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub rpc_url_http: String,
    pub rpc_url_ws: String,
    pub signer_private_key: String,
    pub app_id: String,
    pub batch_size: usize,
    pub batch_timeout_sec: u64,
    pub queue_max_size: usize,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();

        let rpc_url_http = env::var("RPC_URL_HTTP")
            .map_err(|_| "RPC_URL_HTTP is required")?;

        let rpc_url_ws = env::var("RPC_URL_WS")
            .map_err(|_| "RPC_URL_WS is required")?;

        let signer_private_key = env::var("SIGNER_PRIVATE_KEY")
            .map_err(|_| "SIGNER_PRIVATE_KEY is required")?;

        let app_id = env::var("APP_ID")
            .unwrap_or_else(|_| "Mira Network".to_string());

        let batch_size = env::var("BATCH_SIZE")
            .unwrap_or_else(|_| "500".to_string())
            .parse::<usize>()
            .map_err(|_| "BATCH_SIZE must be a valid number")?;

        let batch_timeout_sec = env::var("BATCH_TIMEOUT_SEC")
            .unwrap_or_else(|_| "600".to_string())
            .parse::<u64>()
            .map_err(|_| "BATCH_TIMEOUT_SEC must be a valid number")?;

        let queue_max_size = env::var("QUEUE_MAX_SIZE")
            .unwrap_or_else(|_| "10000".to_string())
            .parse::<usize>()
            .map_err(|_| "QUEUE_MAX_SIZE must be a valid number")?;

        let port = env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse::<u16>()
            .map_err(|_| "PORT must be a valid number")?;

        let config = Config {
            rpc_url_http,
            rpc_url_ws,
            signer_private_key,
            app_id,
            batch_size,
            batch_timeout_sec,
            queue_max_size,
            port,
        };

        tracing::info!("Batch configuration: size={}, timeout={}s, queue_max={}",
                      config.batch_size, config.batch_timeout_sec, config.queue_max_size);

        Ok(config)
    }
}