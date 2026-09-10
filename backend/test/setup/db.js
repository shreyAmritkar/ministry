// ============================================
// test/setup/db.js
// Shared helpers for integration tests that hit a real Postgres.
// ============================================
const { pool } = require('../../db/pool');

/** Wipes every table between tests so each test starts from a clean slate. */
async function resetDb() {
    await pool.query(`
        TRUNCATE TABLE
            refresh_tokens,
            report_status_history,
            report_upvotes,
            report_notifications,
            notifications,
            reports,
            official_tenures,
            users
        RESTART IDENTITY CASCADE
    `);
}

/** Call once in afterAll() per test file — Jest isolates modules per
 * file, so each test file has its OWN pool instance to close. */
async function closeDb() {
    await pool.end();
}

module.exports = { pool, resetDb, closeDb };
