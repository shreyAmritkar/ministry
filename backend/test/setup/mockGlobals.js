// ============================================
// test/setup/mockGlobals.js
// Runs once per test FILE, before that file's requires are resolved
// (Jest's `setupFiles`). Two jobs:
//
// 1. Load .env.test so db/pool.js, JWT signing, etc. all see the test
//    database and a test JWT secret instead of whatever's in the
//    real .env (or nothing at all).
//
// 2. Mock the two BullMQ workers. They construct a real BullMQ
//    `Worker`, which throws synchronously if there's no Redis
//    connection configured — and requiring server.js requires them at
//    the top unconditionally. Everything else in the app (routes,
//    controllers, the report/notification Queues) degrades gracefully
//    without Redis, so only these two need mocking.
//
// Note on `--forceExit` in the `test` npm script: even with the above,
// BullMQ's `Queue` (not `Worker`) silently falls back to a DEFAULT
// ioredis connection (localhost:6379) when constructed with
// `connection: null` — it does not simply disable itself. That
// connection retries indefinitely in the background and is a real,
// intentionally-not-crashing open handle Jest can't wait out. It's
// harmless test-runner noise (no test depends on it, no assertions
// are affected), not a correctness issue, so `--forceExit` is the
// pragmatic call here rather than reaching further into BullMQ's
// connection defaults.
// ============================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });

jest.mock('../../workers/report.worker', () => ({
    close: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../workers/notification.worker', () => ({
    close: jest.fn().mockResolvedValue(undefined),
}));
