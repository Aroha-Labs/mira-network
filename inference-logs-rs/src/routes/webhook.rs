use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Json,
};
use flate2::read::GzDecoder;
use std::io::Read;

use crate::models::{WebhookBody, WebhookResponse, InferenceLog};
use tokio::sync::mpsc;

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
    State(log_sender): State<mpsc::UnboundedSender<InferenceLog>>,
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

    // Send logs to batch accumulator
    let mut failed_logs = 0;
    for log in payload.logs {
        if let Err(_) = log_sender.send(log) {
            failed_logs += 1;
        }
    }

    if failed_logs > 0 {
        tracing::warn!("Failed to queue {} logs", failed_logs);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(WebhookResponse {
                success: false,
                message: format!("Failed to queue {} out of {} logs", failed_logs, logs_count),
                count: None,
            })
        )
    } else {
        tracing::info!("Queued {} logs for batching", logs_count);
        (
            StatusCode::OK,
            Json(WebhookResponse {
                success: true,
                message: format!("Queued {} logs for processing", logs_count),
                count: Some(logs_count),
            })
        )
    }
}