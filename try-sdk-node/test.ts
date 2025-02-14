import { config } from 'dotenv';
import { MiraClient } from '@mira-network/node-sdk';

// Load environment variables
config();

// Initialize the Mira client
const client = new MiraClient({
  apiKey: process.env.MIRA_API_KEY || '',
  baseURL: process.env.MIRA_API_URL || 'https://apis.mira.network',
});

async function main() {
  try {
    // 1. List available models
    console.log('\n1. Fetching available models...');
    const models = await client.listModels();
    console.log('Available models:', JSON.stringify(models, null, 2));

    // 2. Get user credits
    console.log('\n2. Fetching user credits...');
    const credits = await client.getUserCredits();
    console.log('User credits:', JSON.stringify(credits, null, 2));

    // 3. Get credits history
    console.log('\n3. Fetching credits history...');
    const creditsHistory = await client.getCreditsHistory();
    console.log('Credits history:', JSON.stringify(creditsHistory, null, 2));

    // 4. List API tokens
    console.log('\n4. Listing API tokens...');
    const tokens = await client.listApiTokens();
    console.log('API tokens:', JSON.stringify(tokens, null, 2));

    // 5. Create a new API token
    console.log('\n5. Creating a new API token...');
    const newToken = await client.createApiToken({
      name: 'Test Token ' + new Date().toISOString(),
      expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      permissions: ['chat.completions', 'models.list']
    });
    console.log('New API token created:', JSON.stringify(newToken, null, 2));

    // 6. Delete the newly created token
    console.log('\n6. Deleting the new API token...');
    await client.deleteApiToken(newToken.id);
    console.log('Token deleted successfully');

    // 7. Test chat completion with a multi-turn conversation
    console.log('\n7. Testing chat completion with a multi-turn conversation...');
    
    // First message
    console.log('\nSending first message...');
    const completion1 = await client.createChatCompletion({
      model: 'claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant with expertise in programming and technology.'
        },
        {
          role: 'user',
          content: 'What are the main differences between REST and GraphQL APIs?'
        }
      ],
      temperature: 0.7,
      max_tokens: 250
    });

    const assistantResponse1 = completion1.choices[0].message.content;
    console.log('\nAssistant:', assistantResponse1);

    // Follow-up question
    console.log('\nSending follow-up question...');
    const completion2 = await client.createChatCompletion({
      model: 'claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant with expertise in programming and technology.'
        },
        {
          role: 'user',
          content: 'What are the main differences between REST and GraphQL APIs?'
        },
        {
          role: 'assistant',
          content: assistantResponse1
        },
        {
          role: 'user',
          content: 'Can you provide a simple code example comparing a REST endpoint with its GraphQL equivalent?'
        }
      ],
      temperature: 0.7,
      max_tokens: 250
    });

    console.log('\nAssistant:', completion2.choices[0].message.content);

  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      if ('response' in error) {
        // @ts-ignore
        console.error('Response data:', error.response?.data);
      }
    } else {
      console.error('Unknown error:', error);
    }
  }
}

main(); 
