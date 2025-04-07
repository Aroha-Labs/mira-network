# Decentralized Inference Network Architecture

## Core Components

### Client Layer
- **API Consumers**: Client applications consuming inference APIs
- **Authentication**: Supabase Auth
- **API Endpoints**: generate and verifiedGenerate

### Network Layer
- **Router Service**: Main request orchestrator (AWS Fargate)
- **Security**: AWS WAF
- **Load Balancing**: AWS ALB

### Caching & Storage
- **Caching**: AWS ElastiCache
- **Primary Database**: PostgreSQL
- **Analytics Engine**: OpenSearch

### Inference Layer
- **Node Service**: Decentralized inference nodes (AWS Fargate)
- **Model Integration**: Connection to AI model providers

## System Flow
1. Clients authenticate via Supabase Auth and call generate/verifiedGenerate APIs
2. Requests pass through Cloudflare and AWS WAF security layers
3. AWS ALB distributes load across Router Service instances
4. Router Service (AWS Fargate):
   - Validates requests
   - Checks cache in AWS ElastiCache
   - Routes to appropriate Node Service
5. Node Service (AWS Fargate):
   - Communicates with AI model providers
   - Performs inference
   - Returns results to Router
6. Results are cached and returned to clients
7. All analytics data is stored in OpenSearch

## Security Implementation
- **Authentication**: Mira key managment system
- **Network Security**: AWS WAF
- **API Security**: Rate limiting and request validation

## Scaling Strategy
- AWS Fargate for auto-scaling both Router and Node services
- ElastiCache for reducing load on model providers
- PostgreSQL for reliable data persistence

## Monitoring & Analytics
- OpenSearch for comprehensive analytics:
  - Request patterns
  - Model performance
  - Error rates
  - Latency metrics
