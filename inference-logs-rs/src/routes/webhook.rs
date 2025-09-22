use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Json,
};
use flate2::read::GzDecoder;
use std::io::Read;
use std::sync::Arc;

use crate::models::{WebhookBody, WebhookResponse};
use crate::services::blockchain::BlockchainService;

pub async fn health() -> (StatusCode, Json<WebhookResponse>) {
    (
        StatusCode::OK,
        Json(WebhookResponse {
            success: true,
            message: "Webhook endpoint is healthy".to_string(),
            count: None,
        })
    )
}

pub async fn inference_webhook(
    State(blockchain): State<Arc<BlockchainService>>,
    headers: HeaderMap,
    body: Bytes,
) -> (StatusCode, Json<WebhookResponse>) {
    // Check if the request is gzip compressed
    let is_gzipped = headers
        .get("content-encoding")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.contains("gzip"))
        .unwrap_or(false);

    // Decompress if needed and parse JSON
    let payload: WebhookBody = if is_gzipped {
        let mut decoder = GzDecoder::new(&body[..]);
        let mut decompressed = String::new();
        match decoder.read_to_string(&mut decompressed) {
            Ok(_) => {},
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(WebhookResponse {
                        success: false,
                        message: format!("Failed to decompress gzip: {}", e),
                        count: None,
                    })
                );
            }
        }

        match serde_json::from_str(&decompressed) {
            Ok(p) => p,
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(WebhookResponse {
                        success: false,
                        message: format!("Failed to parse JSON: {}", e),
                        count: None,
                    })
                );
            }
        }
    } else {
        match serde_json::from_slice(&body) {
            Ok(p) => p,
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(WebhookResponse {
                        success: false,
                        message: format!("Failed to parse JSON: {}", e),
                        count: None,
                    })
                );
            }
        }
    };

    let logs_count = payload.logs.len();

    if logs_count == 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(WebhookResponse {
                success: false,
                message: "No logs provided".to_string(),
                count: None,
            })
        );
    }

    match blockchain.submit_batch_logs(payload.logs).await {
        Ok(_) => {
            tracing::info!("Successfully submitted {} logs", logs_count);
            (
                StatusCode::OK,
                Json(WebhookResponse {
                    success: true,
                    message: format!("Successfully submitted {} logs", logs_count),
                    count: Some(logs_count),
                })
            )
        },
        Err(e) => {
            tracing::error!("Failed to submit logs: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(WebhookResponse {
                    success: false,
                    message: format!("Failed to submit logs: {}", e),
                    count: None,
                })
            )
        }
    }
}