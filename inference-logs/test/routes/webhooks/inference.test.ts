import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helpers';

// We'll skip actual blockchain calls during tests
// by overriding the service in the route handler

test('webhook returns 400 if no logs provided', async (t) => {
    const app = await build(t);

    const res = await app.inject({
        url: '/webhooks/inference',
        method: 'POST',
        payload: { logs: [] },
    });

    assert.equal(res.statusCode, 400);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.success, false);
    assert.equal(payload.message, 'No logs provided');
});

test('webhook validates input format', async (t) => {
    const app = await build(t);

    const res = await app.inject({
        url: '/webhooks/inference',
        method: 'POST',
        payload: {
            logs: [
                {
                    // Missing required fields
                    timestamp: '2023-07-19T12:34:56.789Z',
                },
            ],
        },
    });

    assert.equal(res.statusCode, 400);
});

test('health endpoint returns ok', async (t) => {
    const app = await build(t);

    const res = await app.inject({
        url: '/webhooks/inference/health',
        method: 'GET',
    });

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.status, 'ok');
}); 