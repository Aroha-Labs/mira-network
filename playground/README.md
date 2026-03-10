# 🎮 Mira Playground

<div align="center">

_A powerful web interface for interacting with and testing Mira's AI capabilities_

[Documentation](https://docs.mira.network) • [Live Demo](https://console.mira.network) • [Report Bug](https://feedback.mira.network)

</div>


---

## ✨ Features

- 🤖 Interactive chat interface with multiple AI models
- 🔧 Advanced system prompt configuration
- 🛠️ Built-in developer tools and debugging features
- 📊 Real-time usage analytics and cost tracking
- 🔑 Secure API key management
- 🌐 Network performance monitoring
- 💻 Integrated terminal interface
- 👥 User and role management for administrators

## 🚀 Getting Started


### Prerequisites

- Node.js 18.x or higher
- Yarn package manager
- Supabase account for authentication
- Valid Mira API credentials

### Installation

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/miranetwork/playground.git
cd playground
yarn install
```

2. Set up environment variables:

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

3. Run the development server:

```bash
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## 🏗️ Development

### Project Structure

```
src/
├── app/          # Next.js 13+ app directory
│   ├── admin/    # Admin panel routes
│   ├── chat/     # Chat interface
│   └── api/      # API routes
├── components/   # Reusable React components
├── hooks/        # Custom React hooks
├── utils/        # Utility functions
├── types/        # TypeScript type definitions
└── lib/          # Shared libraries
```

### Key Pages

| Route             | Description                     |
| ----------------- | ------------------------------- |
| `/`               | Dashboard & Overview            |
| `/chat`           | AI Chat Interface               |
| `/playground`     | Interactive Testing Environment |
| `/terminal`       | Terminal Interface              |
| `/api-keys`       | API Key Management              |
| `/api-logs`       | Request Logs & Analytics        |
| `/network`        | Network Status & Monitoring     |
| `/analytics`      | Usage Analytics & Reports       |
| `/admin/users`    | User Management                 |
| `/admin/machines` | Machine Management              |
| `/admin/settings` | System Settings                 |

## 📚 Documentation

For detailed documentation about Mira and its capabilities, visit our [Documentation Portal](https://docs.mira.network).

## 🚢 Deployment

The application is automatically deployed to Cloudflare Pages when changes are pushed to the main branch.

### Environment Variables

Required environment variables for deployment:

| Variable                        | Description            |
| ------------------------------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_API_BASE_URL`      | Mira API base URL      |
| `NEXT_PUBLIC_LLM_BASE_URL`      | LLM API base URL       |
| `NEXT_PUBLIC_VERSION`           | Application version    |

### Build Process

1. Runs tests and linting checks
2. Builds the Next.js application
3. Generates static export
4. Deploys to Cloudflare Pages
5. Creates a new version tag and release

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔒 Security

For security issues, please email security@mira.network instead of using the issue tracker.

