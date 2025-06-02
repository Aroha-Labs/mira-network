# Inference Logs Webhook Service

This service provides a webhook endpoint to receive inference logs and submit them to the Mira Network blockchain using the `submitBatchInferenceLogs` function.

## Features

- Webhook endpoint to receive inference logs
- Blockchain integration using Viem
- Support for both single and batch submissions
- Health check endpoint

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `env.example` to `.env` and update with your values
4. Start the service: `npm run dev`

## API Documentation

See [webhook documentation](./src/routes/webhooks/README.md) for detailed API information.

## Available Scripts

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.

## Environment Variables

The following environment variables are required:

- `SIGNER_PRIVATE_KEY`: Private key for the wallet that will sign transactions

Optional variables:
- `RPC_URL_HTTP`: HTTP URL for the blockchain RPC
- `RPC_URL_WS`: WebSocket URL for the blockchain RPC
- `APP_ID`: Application ID used when submitting logs
- `BATCH_SIZE`: Maximum number of logs to submit in a single batch
- `PORT`: Port to run the server on
- `HOST`: Host to bind the server to

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
