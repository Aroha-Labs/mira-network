# Inference Logs Webhook

This webhook provides an endpoint for receiving inference logs and submitting them to the blockchain using the Mira Network contract.

## Endpoints

### POST /webhooks/inference

Receives inference logs and submits them to the blockchain.

#### Request body

```json
{
  "logs": [
    {
      "walletAddress": "0x1234567890123456789012345678901234567890",
      "logId": "unique-log-id-1",
      "@timestamp": "2023-07-19T12:34:56.789Z"
    },
    {
      "walletAddress": "0x0987654321098765432109876543210987654321",
      "logId": "unique-log-id-2",
      "@timestamp": "2023-07-19T12:35:56.789Z"
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "message": "Logs batch submitted to blockchain",
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "processedLogs": 2
}
```

### GET /webhooks/inference/health

Health check endpoint to verify the service is running.

#### Response

```json
{
  "status": "ok"
}
```

## Environment Variables

The following environment variables can be set to configure the service:

- `RPC_URL_HTTP`: HTTP URL for the blockchain RPC (default: "https://rpc-test0-two-zepe2m25hg.t.conduit.xyz")
- `RPC_URL_WS`: WebSocket URL for the blockchain RPC (default: "wss://rpc-test0-two-zepe2m25hg.t.conduit.xyz")
- `SIGNER_PRIVATE_KEY`: Private key for the wallet that will sign the transactions (required)
- `APP_ID`: Application ID used when submitting logs (default: "Klok")
- `BATCH_SIZE`: Maximum number of logs to submit in a single batch (default: 100) 