# 🎮 Mira Playground

<div align="center">

[![Deploy Status](https://img.shields.io/github/actions/workflow/status/Aroha-Labs/mira-client/release.yml?label=deploy)](https://github.com/Aroha-Labs/mira-client/actions/workflows/release.yml)
[![Latest Release](https://img.shields.io/github/v/release/Aroha-Labs/mira-client)](https://github.com/Aroha-Labs/mira-client/releases)
[![License](https://img.shields.io/github/license/Aroha-Labs/mira-client)](LICENSE)

_A powerful web interface for interacting with and testing Mira's AI capabilities_

[Documentation](https://docs.mira.ai) • [Live Demo](https://playground.mira.network) • [Report Bug](https://github.com/Aroha-Labs/mira-client/issues)

</div>

---

## ✨ Features

- 🤖 Interactive chat interface for testing AI models
- 🔑 API key management and authentication
- 📊 Comprehensive usage analytics and logs
- 🌐 Real-time network monitoring
- 👥 Advanced admin controls for user management
- 💻 Integrated terminal interface

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- Yarn package manager

### Installation

1. Install dependencies:

```bash
yarn install
```

2. Run the development server:

```bash
yarn dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## 🏗️ Development

### Project Structure

```
src/
├── app/          # Main application code
├── components/   # Reusable components
├── utils/        # Utility functions
└── types/        # TypeScript type definitions
```

### Key Pages

| Route       | Description                |
| ----------- | -------------------------- |
| `/`         | Home/Dashboard             |
| `/login`    | Authentication             |
| `/api-keys` | API key management         |
| `/api-logs` | Request logs and analytics |
| `/network`  | Network monitoring         |
| `/terminal` | Terminal interface         |
| `/admin/*`  | Admin controls             |

## 📚 Documentation

For more information about Mira and its capabilities, visit our [Documentation](https://docs.mira.ai).

## 🚢 Deployment

The application is automatically deployed to Cloudflare Pages when changes are pushed to the main branch.

### Deployment Process

1. Builds the application with required environment variables
2. Publishes the `out` directory to Cloudflare Pages
3. Creates a new version tag and GitHub release

### Environment Variables

The following environment variables are required for deployment:

| Variable                        | Description            |
| ------------------------------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_API_BASE_URL`      | Mira API base URL      |
| `NEXT_PUBLIC_LLM_BASE_URL`      | LLM API base URL       |
| `NEXT_PUBLIC_VERSION`           | Application version    |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
