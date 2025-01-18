# Mira Playground

A web interface for interacting with and testing Mira's AI capabilities.

## Features

- Interactive chat interface for testing AI models
- API key management
- Usage analytics and logs
- Network monitoring
- Admin controls for user and machine management
- Terminal interface

## Getting Started

1. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Development

- The main application code is in `src/app`
- Components are in `src/components`
- Utility functions are in `src/utils`
- Types are in `src/types`

## Key Pages

- `/` - Home/Dashboard
- `/login` - Authentication
- `/api-keys` - API key management
- `/api-logs` - Request logs and analytics
- `/network` - Network monitoring
- `/terminal` - Terminal interface
- `/admin/*` - Admin controls

## Learn More

- [Mira Documentation](https://docs.mira.ai)

## Deployment

The application is automatically deployed to Cloudflare Pages when changes are pushed to the main branch. The deployment process:

1. Builds the application with required environment variables
2. Publishes the `out` directory to Cloudflare Pages
3. Creates a new version tag and GitHub release

Required environment variables for deployment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_LLM_BASE_URL`
- `NEXT_PUBLIC_VERSION`
