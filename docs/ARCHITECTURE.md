# Architecture

The system follows a microservices architecture with the following components:

## Components

- **Router Service**: Core routing and load balancing
- **Console**: Web-based management interface
- **CLI**: Command-line management tool
- **Service**: Provider integration and request handling

## Component Details

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
