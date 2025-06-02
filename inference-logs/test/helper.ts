// This file contains code that we reuse between our tests.
import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import App from '../src/app';
import { test } from 'node:test';

export type TestContext = {
  after: typeof test.after
}

// Fill in this config with all the configurations
// needed for testing the application
async function config() {
  return {};
}

// Automatically build and tear down our instance
export async function build(t: any): Promise<FastifyInstance> {
  const app = Fastify();

  // Mock environment variables for testing
  process.env.SIGNER_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  // Override blockchain service functions to prevent actual blockchain calls during tests
  app.decorate('submitBatchInferenceLogs', () => '0xmocktxhash');
  app.decorate('submitInferenceLog', () => '0xmocktxhash');

  // fastify-plugin ensures that all decorators
  // are exposed for testing purposes, this is
  // different from the production setup
  void app.register(fp(App), await config());

  await app.ready();

  // Tear down the app after the test is complete
  t.after(() => app.close());

  return app;
}
