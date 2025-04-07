# Mira Network Service (Go Implementation)

This is a high-performance Go implementation of the Mira Network service component, designed to efficiently handle LLM API calls with robust error handling and scalability.

## Features

- **High Performance**: Built in Go for optimal concurrency and resource efficiency
- **Low Latency**: Minimal overhead for streaming and non-streaming LLM responses
- **Robust Error Handling**: Comprehensive error handling and graceful degradation
- **Streaming Support**: Server-sent events (SSE) implementation for streaming LLM responses
- **Containerization**: Docker support for consistent deployment
- **Graceful Shutdown**: Proper signal handling for clean shutdowns
- **Configurable**: Environment variable configuration for flexibility
- **Developer Friendly**: Hot reload support during development
- **Well Documented**: Comprehensive code documentation and API documentation

## Prerequisites

- Go 1.18 or higher
- Docker (optional, for containerized deployment)

## Getting Started

### Local Development

1. Install Go dependencies:

```bash
go mod download
```

2. Run the service locally:

```bash
go run main.go
```

Or using the Makefile:

```bash
make run
```

3. For development with hot reload:

```bash
# Install the air tool first
go install github.com/cosmtrek/air@latest

# Then run with hot reloading
make dev
```

### Docker Deployment

1. Build the Docker image:

```bash
make docker-build
```

2. Run the containerized service:

```bash
make docker-run
```

## API Endpoints

The service exposes the following endpoints:

- `GET /health` - Health check endpoint
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Generate chat completions
- `POST /v1/verify` - Verify model responses
- `POST /v1/eval` - Evaluate model performance on prompts

## Configuration

The service can be configured using environment variables:

- `PORT` - The port number to listen on (default: 8000)
- `VERSION` - Service version string (default: 0.0.0)
- `ROUTER_BASE_URL` - URL of the router service

## Architecture

The service follows a clean architecture approach:

- **Handlers**: HTTP request handlers
- **Models**: Data structures for requests and responses
- **Utils**: Helper functions
- **Config**: Configuration management

## Error Handling

The service implements robust error handling:

- Request validation errors return appropriate HTTP status codes
- Internal errors are properly logged
- Streaming errors are gracefully managed
- All errors include descriptive messages

## Performance Considerations

This service is designed with performance in mind:

- Connection pooling for HTTP clients
- Efficient memory usage
- Proper timeout handling
- Garbage collection optimization
- Minimal dependencies

## Comparison with Python Implementation

Compared to the Python implementation, this Go service offers:

- Lower latency for request handling
- Better concurrency for managing multiple simultaneous connections
- More efficient memory usage
- Improved stability under high load
- Superior handling of streaming responses

## License

Copyright © 2023 Mira Network 
