use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceLog {
    pub wallet_address: String,
    pub log_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processed: Option<bool>,
    #[serde(rename = "@timestamp", skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WebhookBody {
    pub logs: Vec<InferenceLog>,
}

#[derive(Debug, Serialize)]
pub struct WebhookResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<usize>,
}