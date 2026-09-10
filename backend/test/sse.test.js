// ============================================
// test/sse.test.js
// Integration tests for the SSE streams (services/sseService.js).
//
// supertest can't be used here: it waits for the HTTP response to
// end before resolving, and an SSE response never ends on its own.
// Instead we boot the real app on an ephemeral port and read the
// stream with plain `http.get`, destroying the request once we've
// seen what we're looking for (or a timeout elapses).
// ============================================
const http = require('http');
const request = require('supertest');
const { app } = require('../server');
const { resetDb, closeDb } = require('./setup/db');

let server;
let baseUrl;

function readStreamUntil(url, predicate, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            if (res.statusCode !== 200) {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => reject(new Error(`Expected 200, got ${res.statusCode}: ${body}`)));
                return;
            }

            let buffer = '';
            const timer = setTimeout(() => {
                req.destroy();
                reject(new Error(`Timed out after ${timeoutMs}ms waiting for expected SSE content. Got so far:\n${buffer}`));
            }, timeoutMs);

            res.on('data', (chunk) => {
                buffer += chunk.toString();
                if (predicate(buffer)) {
                    clearTimeout(timer);
                    req.destroy();
                    resolve(buffer);
                }
            });
        });

        req.on('error', (err) => {
            // Destroying the request after we've already resolved() fires
            // an ECONNRESET here too — harmless, and reject() on an
            // already-settled promise is a no-op, so this is safe either way.
            reject(err);
        });
    });
}

describe('SSE streams', () => {
    let accessToken;
    let userId;

    beforeAll(async () => {
        await resetDb();
        server = app.listen(0);
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;

        await request(app).post('/api/v1/auth/register').send({
            name: 'SSE User', email: 'sse@test.com', password: 'pass1234',
        });
        const login = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'sse@test.com', password: 'pass1234' });
        accessToken = login.body.data.accessToken;
        userId = login.body.data.user._id;
    });

    afterAll(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        await closeDb();
    });

    test('notification stream rejects a request with no token', async () => {
        await expect(
            readStreamUntil(`${baseUrl}/api/v1/notifications/stream`, () => true, 2000)
        ).rejects.toThrow(/Expected 200, got 401/);
    });

    test('notification stream sends a connected event for a valid token', async () => {
        const buffer = await readStreamUntil(
            `${baseUrl}/api/v1/notifications/stream?token=${accessToken}`,
            (buf) => buf.includes('event: connected')
        );
        expect(buffer).toContain('event: connected');
    });

    test('report stream sends a connected event with no auth required', async () => {
        const buffer = await readStreamUntil(
            `${baseUrl}/api/v1/reports/00000000-0000-0000-0000-000000000000/stream`,
            (buf) => buf.includes('event: connected')
        );
        expect(buffer).toContain('event: connected');
    });

    test('a notification created server-side is pushed live to an open stream', async () => {
        const notificationService = require('../services/notificationService');

        const streamPromise = readStreamUntil(
            `${baseUrl}/api/v1/notifications/stream?token=${accessToken}`,
            (buf) => buf.includes('Live push test') // wait for the actual payload, not just the event name — `event:` and `data:` arrive as separate writes/chunks
        );

        // Give the connection a moment to actually register before pushing —
        // otherwise there's a race between "stream open" and "event sent".
        await new Promise((resolve) => setTimeout(resolve, 300));

        await notificationService.createNotification({
            recipientId: userId,
            type: 'system_announcement',
            title: 'Live push test',
            message: 'If you see this in the test output, the wiring works end to end.',
        });

        const buffer = await streamPromise;
        expect(buffer).toContain('event: notification');
        expect(buffer).toContain('Live push test');
    });
});
