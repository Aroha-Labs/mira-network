import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    // Ramp-up phase
    { duration: '1m', target: 1000 },  // Ramp up to 1000 users over 1 minute
    { duration: '2m', target: 5000 },  // Ramp up from 1000 to 5000 users over 2 minutes
    { duration: '2m', target: 10000 }, // Ramp up from 5000 to 10000 users over 2 minutes
    // Sustain phase
    { duration: '5m', target: 10000 }, // Stay at 10000 users for 5 minutes
    // Ramp-down phase
    { duration: '1m', target: 5000 },  // Ramp down from 10000 to 5000 users over 1 minute
    { duration: '1m', target: 0 },     // Ramp down to 0 users over 1 minute
  ],
  thresholds: {
    'errors': ['rate<0.1'], // Error rate should be less than 10%
    'http_req_duration': ['p(95)<5000'], // 95% of requests should be below 5 seconds
  },
};

// --- IMPORTANT ---
// Ensure this URL and the model name in TEST_PROMPTS match your vLLM server setup.
// Load testing a production or shared environment with 10,000 VUs without permission can cause disruptions.
const VLLM_API_URL = 'http://your_endpoint:8000/v1/completions'; // Or your specific endpoint

// Example prompts for testing
// Ensure the "model" field here matches the model loaded by your vLLM instance.
const TEST_PROMPTS = [
  {
    model: "Qwen/Qwen3-8B", // CHANGE THIS if your vLLM server is running a different model (e.g., Qwen/Qwen3-30B-A3B)
    prompt: "San Francisco is a city known for",
    max_tokens: 50,
    temperature: 0.7
  },
  {
    model: "Qwen/Qwen3-8B", // CHANGE THIS
    prompt: "The key benefits of artificial intelligence in healthcare include",
    max_tokens: 70,
    temperature: 0.7
  },
  {
    model: "Qwen/Qwen3-8B", // CHANGE THIS
    prompt: "Write a Python function that calculates the factorial of a number.",
    max_tokens: 100,
    temperature: 0.5
  },
  {
    model: "Qwen/Qwen3-8B", // CHANGE THIS
    prompt: "Explain the concept of blockchain technology in simple terms.",
    max_tokens: 80,
    temperature: 0.6
  }
];

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      // If your vLLM server is configured with an API key (--api-key flag), uncomment and set it:
      // 'Authorization': 'Bearer YOUR_VLLM_API_KEY',
    },
    // It's good practice to set a timeout for individual HTTP requests in k6,
    // especially for potentially long-running LLM generations.
    // This is different from the global requestTimeout in options.
    timeout: '90s', // Timeout for this specific request
  };

  // Randomly select a test prompt
  const payload = JSON.stringify(TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)]);

  // Make the request
  const response = http.post(VLLM_API_URL, payload, params);

  // Check if the request was successful
  const success = check(response, {
    'is status 200': (r) => r.status === 200,
    'has valid response structure': (r) => {
      if (r.status !== 200) return false; // Don't parse body if status is not 200
      try {
        const body = r.json(); // k6 can parse JSON directly
        return body &&
          body.choices &&
          Array.isArray(body.choices) &&
          body.choices.length > 0 &&
          body.choices[0].text &&
          typeof body.choices[0].text === 'string' &&
          body.usage &&
          typeof body.usage.completion_tokens === 'number' &&
          body.usage.completion_tokens >= 0; // Can be 0 if max_tokens is hit early or stop sequence
      } catch (e) {
        console.error(`Failed to parse JSON response or invalid structure: ${r.body}`);
        return false;
      }
    },
  });

  // Record errors
  if (!success) {
    errorRate.add(1); // Add 1 to the error rate if any check failed
    // Optionally log more details about the failure
    // console.error(`Request failed! Status: ${response.status}, Body: ${response.body}`);
  } else {
    errorRate.add(0);
  }

  // Sleep for a short duration between requests by the same virtual user.
  // This simulates some think time or pacing.
  // With 10,000 VUs, the aggregate request rate will still be very high.
  // The actual RPS will be limited by server response times more than this sleep.
  sleep(1); // Sleep for 1 second
}
