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
