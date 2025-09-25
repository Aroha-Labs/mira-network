mod config;
mod models;
mod routes;
mod services;

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    limit::RequestBodyLimitLayer,
};

use config::Config;
use services::blockchain::BlockchainService;
use services::batch_accumulator::BatchAccumulator;
use routes::webhook::{health, inference_webhook};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("inference_logs_rs=info".parse()?)
        )
        .init();

    let config = Config::from_env()?;
    let port = config.port;

    tracing::info!("Initializing blockchain service...");
    let blockchain_service = Arc::new(BlockchainService::new(config.clone()).await?);

    tracing::info!("Initializing batch accumulator...");
    let (batch_accumulator, log_sender) = BatchAccumulator::new(
        blockchain_service,
        config.clone(),
    );

    // Start the batch accumulator
    batch_accumulator.start().await;

    tracing::info!(
        "Batch accumulator started - batch_size: {}, timeout: {}s, queue_max: {}",
        config.batch_size,
        config.batch_timeout_sec,
        config.queue_max_size
    );

    let app = Router::new()
        .route("/health", get(health))
        .route("/webhooks", post(inference_webhook))
        .with_state(log_sender)
        .layer(
            ServiceBuilder::new()
                .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024))
                .layer(CompressionLayer::new())
        );

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Server listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
