# Mira Network Node.js SDK

<div align="center">

![Mira Network](https://raw.githubusercontent.com/mira-network/node-sdk/main/assets/logo.png)

[![npm version](https://img.shields.io/npm/v/@mira-network/node-sdk.svg?style=flat-square)](https://www.npmjs.org/package/@mira-network/node-sdk)
[![install size](https://img.shields.io/bundlephobia/minzip/@mira-network/node-sdk?style=flat-square)](https://bundlephobia.com/result?p=@mira-network/node-sdk)
[![npm downloads](https://img.shields.io/npm/dm/@mira-network/node-sdk.svg?style=flat-square)](https://npm-stat.com/charts.html?package=@mira-network/node-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**🚀 The official Node.js SDK for Mira Network - OpenAI Compatible AI Platform**

[Documentation](https://docs.mira.network) |
[API Reference](https://api.mira.network) |
[Examples](https://github.com/mira-network/node-sdk/tree/main/examples) |
[Support](https://discord.gg/mira-network)

</div>

---

## ✨ Highlights

- 🎯 **Drop-in OpenAI Replacement** - Switch from OpenAI with minimal code changes
- 🚀 **Full TypeScript Support** - Complete type definitions for all APIs
- 🔄 **Streaming Support** - Real-time streaming for chat completions
- 📦 **Modern ESM Package** - Built for modern JavaScript/TypeScript
- 🛡️ **Enterprise Ready** - Comprehensive error handling and retries
- 💳 **Credits Management** - Built-in tools for usage tracking
- 🔑 **Token Management** - Secure API token handling
- 📊 **Model Information** - Detailed model specs and pricing

## 🚀 Quick Start

### Installation

```bash
# Using npm
npm install @mira-network/node-sdk

# Using yarn
yarn add @mira-network/node-sdk

# Using pnpm
pnpm add @mira-network/node-sdk
```

### Basic Usage

```typescript
import MiraClient from '@mira-network/node-sdk';

const client = new MiraClient({
  apiKey: process.env.MIRA_API_KEY,
});

async function quickStart() {
  const completion = await client.createChatCompletion({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' }
    ],
  });

  console.log(completion.choices[0].message.content);
}
```

## 🎯 Features

### 💬 Chat Completions

```typescript
// Regular completion
const completion = await client.createChatCompletion({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  max_tokens: 150,
});

// Streaming completion
const stream = client.createChatCompletionStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story.' }],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0].delta.content || '');
}
```

### 🤖 Models

```typescript
// List all available models
const models = await client.listModels();

// Example model information
console.log(models[0]);
// {
//   id: 'gpt-4',
//   name: 'GPT-4',
//   description: 'Most capable model, great for tasks that require creativity and advanced reasoning',
//   max_tokens: 8192,
//   pricing: {
//     input: 0.03,
//     output: 0.06
//   }
// }
```

### 🔑 API Token Management

```typescript
// Create a new API token
const token = await client.createApiToken({
  name: 'Production API Key',
  expiration: '2024-12-31T23:59:59Z',
  permissions: ['chat.completions', 'models.list']
});

// List all tokens
const tokens = await client.listApiTokens();

// Delete a token
await client.deleteApiToken(token.id);
```

### 💳 Credits Management

```typescript
// Check available credits
const credits = await client.getUserCredits();
console.log(`Available credits: ${credits.available}`);
console.log(`Total used: ${credits.used}`);

// View transaction history
const history = await client.getCreditsHistory();
console.log('Recent transactions:', history);
```

## ⚙️ Configuration

```typescript
const client = new MiraClient({
  apiKey: 'your-api-key',
  baseURL: 'https://apis.mira.network', // Optional: custom API endpoint
  timeout: 30000,                       // Optional: request timeout in ms
  maxRetries: 3,                        // Optional: retry failed requests
});
```

## 📚 API Reference

### MiraClient Methods

<details>
<summary><strong>Chat Completions</strong></summary>

- `createChatCompletion(params: ChatCompletionCreateParams): Promise<ChatCompletion>`
- `createChatCompletionStream(params: ChatCompletionCreateParams): AsyncGenerator<ChatCompletionChunk>`

</details>

<details>
<summary><strong>Models</strong></summary>

- `listModels(): Promise<Model[]>`

</details>

<details>
<summary><strong>API Tokens</strong></summary>

- `createApiToken(request: ApiTokenRequest): Promise<ApiToken>`
- `listApiTokens(): Promise<ApiToken[]>`
- `deleteApiToken(token: string): Promise<void>`

</details>

<details>
<summary><strong>Credits</strong></summary>

- `getUserCredits(): Promise<UserCredits>`
- `getCreditsHistory(): Promise<CreditsHistory[]>`

</details>

## 🔒 Error Handling

```typescript
try {
  const completion = await client.createChatCompletion({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }]
  });
} catch (error) {
  if (error.response?.status === 401) {
    console.error('Invalid API key');
  } else if (error.response?.status === 429) {
    console.error('Rate limit exceeded');
  } else {
    console.error('An error occurred:', error.message);
  }
}
```

## 🧪 TypeScript Support

The SDK includes comprehensive TypeScript definitions:

```typescript
import type {
  ChatCompletionCreateParams,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessage,
  ApiTokenRequest,
  ApiToken,
  UserCredits,
  CreditsHistory,
  Model,
} from '@mira-network/node-sdk';
```

## 🤝 Contributing

We welcome contributions! Please see our [contributing guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💫 Support

- 📚 [Documentation](https://docs.mira.network)
- 💬 [Discord Community](https://discord.gg/mira-network)
- 🐛 [Issue Tracker](https://github.com/mira-network/node-sdk/issues)
- 📧 [Email Support](mailto:support@mira.network)

---

<div align="center">

Made with ❤️ by [Mira Network](https://mira.network)

</div> 
