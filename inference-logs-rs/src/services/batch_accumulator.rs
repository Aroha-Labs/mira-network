use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, mpsc};
use tokio::time::sleep;

use crate::config::Config;
use crate::models::InferenceLog;
use crate::services::blockchain::BlockchainService;

pub struct BatchAccumulator {
    logs: Arc<Mutex<Vec<InferenceLog>>>,
    last_send: Arc<Mutex<Instant>>,
    blockchain_service: Arc<BlockchainService>,
    config: Config,
    log_receiver: Arc<Mutex<Option<mpsc::UnboundedReceiver<InferenceLog>>>>,
}

impl BatchAccumulator {
    pub fn new(
        blockchain_service: Arc<BlockchainService>,
        config: Config,
    ) -> (Self, mpsc::UnboundedSender<InferenceLog>) {
        let (sender, receiver) = mpsc::unbounded_channel();

        let accumulator = Self {
            logs: Arc::new(Mutex::new(Vec::new())),
            last_send: Arc::new(Mutex::new(Instant::now())),
            blockchain_service,
            config,
            log_receiver: Arc::new(Mutex::new(Some(receiver))),
        };

        (accumulator, sender)
    }

    pub async fn start(&self) {
        // Take the receiver out of the Option
        let mut receiver = {
            let mut guard = self.log_receiver.lock().await;
            guard.take().expect("BatchAccumulator already started")
        };

        let logs = Arc::clone(&self.logs);
        let last_send = Arc::clone(&self.last_send);
        let blockchain_service = Arc::clone(&self.blockchain_service);
        let config = self.config.clone();

        // Start the log receiver task
        let receiver_logs = Arc::clone(&logs);
        let receiver_last_send = Arc::clone(&last_send);
        let receiver_blockchain_service = Arc::clone(&blockchain_service);
        let receiver_config = config.clone();
        tokio::spawn(async move {
            while let Some(log) = receiver.recv().await {
                let mut logs_guard = receiver_logs.lock().await;

                // Check if queue is full, remove oldest if needed
                if logs_guard.len() >= receiver_config.queue_max_size {
                    logs_guard.remove(0);
                    tracing::warn!("Queue full, dropped oldest log");
                }

                logs_guard.push(log);
                tracing::debug!("Added log to batch queue, total: {}", logs_guard.len());

                // Check if we should send immediately (batch size reached)
                if logs_guard.len() >= receiver_config.batch_size {
                    drop(logs_guard); // Release lock before sending

                    tracing::info!(
                        "Batch size reached ({}), sending immediately",
                        receiver_config.batch_size
                    );
                    if let Err(e) = Self::send_batch_if_ready(
                        &receiver_logs,
                        &receiver_last_send,
                        &receiver_blockchain_service,
                        &receiver_config,
                        true,
                    )
                    .await
                    {
                        tracing::error!("Failed to send batch: {}", e);
                    }
                }
            }
        });

        // Start the timer task
        let timer_logs = Arc::clone(&logs);
        let timer_last_send = Arc::clone(&last_send);
        let timer_blockchain_service = Arc::clone(&blockchain_service);
        let timer_config = config.clone();
        tokio::spawn(async move {
            loop {
                sleep(Duration::from_secs(30)).await; // Check every 30 seconds

                if let Err(e) = Self::send_batch_if_ready(
                    &timer_logs,
                    &timer_last_send,
                    &timer_blockchain_service,
                    &timer_config,
                    false,
                )
                .await
                {
                    tracing::error!("Failed to send timed batch: {}", e);
                }
            }
        });

        tracing::info!(
            "BatchAccumulator started with batch_size={}, timeout={}s",
            config.batch_size,
            config.batch_timeout_sec
        );
    }

    async fn send_batch_if_ready(
        logs: &Arc<Mutex<Vec<InferenceLog>>>,
        last_send: &Arc<Mutex<Instant>>,
        blockchain_service: &Arc<BlockchainService>,
        config: &Config,
        force_send: bool,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut logs_guard = logs.lock().await;

        if logs_guard.is_empty() {
            return Ok(());
        }

        let should_send = if force_send {
            true
        } else {
            // Check if timeout has passed
            let last_send_time = *last_send.lock().await;
            let elapsed = last_send_time.elapsed();
            elapsed.as_secs() >= config.batch_timeout_sec
        };

        if should_send {
            let batch_logs = logs_guard.drain(..).collect::<Vec<_>>();
            let batch_size = batch_logs.len();

            // Update last send time
            {
                let mut last_send_guard = last_send.lock().await;
                *last_send_guard = Instant::now();
            }

            drop(logs_guard); // Release lock before blockchain call

            tracing::info!("Sending batch of {} logs to blockchain", batch_size);

            // Send to blockchain
            match blockchain_service.submit_batch_logs(batch_logs).await {
                Ok(_) => {
                    tracing::info!("Successfully sent batch of {} logs", batch_size);
                }
                Err(e) => {
                    tracing::error!("Failed to submit batch: {}", e);
                    return Err(e);
                }
            }
        }

        Ok(())
    }
}
