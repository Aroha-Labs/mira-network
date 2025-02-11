# Mira Client

A distributed system for managing and interacting with various LLM providers through a unified interface. Mira Client enables seamless integration with multiple language models while providing advanced routing, load balancing, and flow management capabilities.

## Overview

Mira Client consists of several integrated components:

### CLI Tool

- Command-line interface for managing services and client operations
- System prompt management and evaluation capabilities
- Service lifecycle management (start, stop, remove)
- Network configuration and client registration

### Console Web Interface

- React+TypeScript based interactive playground
- Visual flow creation and management
- Real-time chat completions with streaming support
- Model selection and provider configuration
- Variable system prompts support
- Save and manage conversation flows

### Router Service

- Load balancing across multiple LLM providers
- Request routing and traffic management
- Client health monitoring and liveness checks
- Flow management and persistence
- Redis-based caching layer

### Service Component

- Direct LLM provider integrations
- API key management and request authentication
- Response streaming and processing
- Model evaluations and benchmarking

## Supported LLM Providers

- OpenAI (GPT models)
- OpenRouter (Multi-provider gateway)
- Anthropic (Claude models)
- Mira (Custom models)
- Custom providers via API configuration

## Features

- Unified interface for multiple LLM providers
- Conversation and system prompt management
- Real-time streaming responses
- Flow-based conversation design
- Load balancing and high availability
- Health monitoring and diagnostics
- Extensible provider architecture

## Quick Start

See the [Setup Guide](SETUP.md) for detailed installation and configuration instructions.

## Configuration

The system can be configured through environment variables or configuration files:

- `MIRA_CONFIG_PATH`: Path to the configuration file (default: `~/.mira/config.yaml`)
- `MIRA_LOG_LEVEL`: Logging level (default: `info`)
- `MIRA_API_KEY`: Your Mira API key for authentication
- `PROVIDER_API_KEYS`: Provider-specific API keys (see [Setup Guide](SETUP.md))

## Playground

The playground environment provides:

- Interactive testing of LLM providers and models
- Real-time response streaming visualization
- System prompt experimentation
- Flow creation and management
- Conversation history and export capabilities

## Development

### Building Components

CLI:

```bash
cd cli
make build
```

Console:

```bash
cd mira-console
npm install
npm run build
```

### Running Tests

```bash
# Run CLI tests
cd cli
make test

# Run console tests
cd mira-console
npm test

# Run service tests
cd service
python -m pytest
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

### Architecture

The system follows a microservices architecture with the following components:

- **Router Service**: Core routing and load balancing
- **Console**: Web-based management interface
- **CLI**: Command-line management tool
- **Service**: Provider integration and request handling

### Requirements

- Python 3.8+
- Node.js 16+
- Redis 6+
- Go 1.19+ (for CLI)

### Basic Usage

Service management:

```bash
./mira-client-linux-v0.0.0 service start
./mira-client-linux-v0.0.0 service stop
./mira-client-linux-v0.0.0 service remove
```

## Support

For API key requests or technical support:

```
mira-api-key-request@alts.dev
```

## License

This project is proprietary software. All rights reserved.
