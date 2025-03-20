Mira Network Monorepo

Welcome to the Mira Network monorepo, developed and maintained by Aroha Labs. This repository houses the core services, SDKs, and tooling that power the Mira Network, a decentralized network designed for efficient and scalable LLM (Large Language Model) inference.

⸻

Table of Contents
 - About Mira Network
 - Monorepo Structure
 - Services Overview

⸻

About Mira Network

Mira Network is a decentralized inference network that allows developers and organizations to leverage distributed LLM nodes. It offers a robust SDK, routing, and authentication mechanisms to ensure secure and performant access to AI models.

⸻

Monorepo Structure

This monorepo follows a service-based architecture, with each component in its own folder. Below is an overview of each service/package in the repository.

```
mira-network/
├── cli/             # CLI tool to operate mira nodes
├── k6-tests/        # Load testing scripts for mira services
├── mira-console/    # Mira console UI for mainnet operations
├── mobile-frontend/ # Mobile app frontend (Mira Chat / Klokapp)
├── router/          # Core API gateway, LLM routing, and authentication service
├── sdk/             # Python SDK for Mira Network
├── sdk-node/        # Node.js SDK for Mira Network
└── service/         # LLM node (Mira node) serving LLM requests
```


⸻

Services Overview

cli/
 - Description: Command Line Interface to manage and operate a Mira Node.
 - Key Features:
	- Node setup and configuration
	- Service lifecycle management
	- Network registration and status monitoring
 - Infrastructure: 
	- Command-line binary
 - Deployment Process:
	- Built and pushed to GitHub releases via GitHub Action

k6-tests/
 - Description: Load and performance testing suite using k6.
 - Purpose:
	- Stress-test Mira Network components
	- Benchmark API and LLM inference performance

mira-console/
 - Description: Web-based UI for interacting with Mira Network mainnet nodes.
 - Usage:
	- Manage nodes via a graphical interface
	- Monitor node and network health
	- User-friendly experience for node operators
 - Infrastructure:
	- Cloudflare Pages hosting
 - Deployment Process:
	- Built and deployed to Cloudflare Pages via GitHub Action

mobile-frontend/
 - Description: Mobile frontend application, powering Mira Chat and Klokapp.
 - Platforms:
 	- Android & iOS
 - Features:
	- End-user chat interface powered by Mira Network's LLM nodes
	- Seamless mobile experience
 - Infrastructure:
	- React Native / Expo framework
	- App Store and Play Store
 - Deployment Process:
	- Built with Expo Application Services (EAS)
	- Build process triggered via GitHub Action
	- Manual publication to Play Store and App Store

router/
 - Description: Core API, routing, and authentication layer for Mira Network.
 - Responsibilities:
	- Secure API access and token management
	- Route LLM requests to optimal nodes
	- Balance load and ensure scalability
 - Infrastructure:
	- Python service
	- Redis (caching/queueing)
	- PostgreSQL (persistent storage)
	- OpenSearch (logging/indexing)
	- Supabase (authentication)
	- NewRelic (monitoring)
	- AWS Fargate (hosting)
 - Deployment Process:
	- Docker image built and published to GitHub Container Registry via GitHub Action
	- Manual deployment to AWS Fargate
	  - Cluster: MiraNetworkCluster
	  - Service: router
	  - Task Definition: mira-network

sdk-node/
 - Description: Node.js SDK to interact with the Mira Network.
 - Usage:
	- Easy integration of Mira Network into Node.js applications
	- LLM request handling and response parsing
 - Infrastructure:
	- npm package
 - Deployment Process:
	- Built, versioned and published to npm registry via GitHub Action

sdk/
 - Description: Python SDK to interface with Mira Network.
 - Usage:
	- Python developers can easily leverage Mira Network capabilities
	- Provides utilities for LLM requests, authentication, and node discovery
 - Infrastructure:
	- Python package (PyPI)
 - Deployment Process:
	- Built, versioned and published to PyPI via GitHub Action

service/
 - Description: The LLM node (Mira Node) responsible for serving LLM requests.
 - Functionality:
	- Inference handling
	- Secure communication with router and clients
	- Resource management and performance optimization
 - Infrastructure:
	- Python service
	- AWS Fargate (hosting)
 - Deployment Process:
	- Docker image built and published to GitHub Container Registry via GitHub Action
	- Manual deployment to AWS Fargate
	  - Cluster: MiraNetworkCluster
	  - Service: service
	  - Task Definition: mira-network-service

⸻

Deployment Guides

AWS Fargate Deployment Process
 - Prerequisites:
   - AWS CLI configured with appropriate permissions
   - Docker image pushed to GitHub Container Registry
   - Task definition registered in AWS ECS

 - Creating/Updating Task Definitions:
   1. Navigate to ECS > Task Definitions in the AWS Management Console
   2. Select "Create new Task Definition" or choose an existing one to revise
   3. For new definitions:
      - Select "Fargate" as launch type compatibility
      - Configure task size (CPU and Memory)
      - Add container details:
        - Container name (router or service)
        - Image URI from GitHub Container Registry
        - Port mappings (typically 8080)
        - Environment variables
        - Log configuration
        - Resource limits
   4. Review and click "Create" to register the task definition
   5. Note the revision number for deployment

 - Deployment Steps:
   1. Login to AWS Management Console or use AWS CLI
   2. Navigate to ECS > Clusters > MiraNetworkCluster
   3. Select the service to update (router or service)
   4. Choose "Update" and specify the new task definition revision
   5. Review settings and confirm deployment
   6. Monitor deployment status and health checks
 - Rollback Process:
   1. In case of issues, select the service
   2. Choose "Update" and specify the previous working task definition
   3. Monitor rollback status

Mobile App Publication Process
 - App Store (iOS) Deployment:
   1. Ensure app is built with production configuration via EAS
   2. Download the .ipa file from EAS build
   3. Use Apple Transporter or App Store Connect to upload the binary
   4. Complete App Store listing information and screenshots
   5. Submit for App Review
   6. Once approved, publish to the App Store
   
 - Play Store (Android) Deployment:
   1. Ensure app is built with production configuration via EAS
   2. Download the .aab (Android App Bundle) from EAS build
   3. Login to Google Play Console
   4. Navigate to your application > Production track
   5. Upload the .aab file and complete release information
   6. Set countries/regions for distribution
   7. Review and start rollout to production
