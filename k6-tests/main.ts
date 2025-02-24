import http from 'k6/http';
import { check, sleep } from 'k6';

// Test configuration
export const options = {
  stages: [
    { duration: '5m', target: 100 },  // Ramp up to 10000 users over 5 minutes
    { duration: '10m', target: 100 },   // Stay at 10000 users for 1 minute
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2000ms
    http_req_failed: ['rate<0.01'],    // Less than 1% of requests should fail
  },
  timeout: '120s',
};

const BASE_URL = 'https://db17-115-187-57-146.ngrok-free.app';
const API_KEY = 'sk-mira-****';

export default function () {
  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: 'yoo',
      },
    ],
    variables: {
      language: 'english',
    },
    stream: false,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    timeout: '60s', // Increase timeout to 60 seconds
  };

  // Make the request
  const response = http.post(
    `${BASE_URL}/v1/flow/17/chat/completions`,
    payload,
    params
  );

  // Log response details for debugging
  console.log(`Status: ${response.status}, Body length: ${response.body.length}`);

  // More detailed checks
  const checks = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has body': (r) => r.body.length > 0,
    'response is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        console.error(`Invalid JSON: ${e.message}`);
        return false;
      }
    },
    'response has choices': (r) => {
      try {
        const body = JSON.parse(r.body);
        const hasChoices = body.choices !== undefined;
        if (!hasChoices) {
          console.error(`Missing choices in response: ${r.body.substring(0, 200)}...`);
        }
        return hasChoices;
      } catch (e) {
        return false;
      }
    },
    'response has content': (r) => {
      try {
        const body = JSON.parse(r.body);
        const hasContent = body.choices &&
          body.choices[0] &&
          body.choices[0].message &&
          body.choices[0].message.content;
        if (!hasContent) {
          console.error(`Missing content in response: ${r.body.substring(0, 200)}...`);
        }
        return hasContent;
      } catch (e) {
        return false;
      }
    }
  });

  if (!checks) {
    console.error(`Failed checks for response: ${response.body.substring(0, 200)}...`);
  }

  // Wait between 1 and 5 seconds before next iteration
  sleep(Math.random() * 4 + 1);
}
