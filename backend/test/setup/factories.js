// ============================================
// test/setup/factories.js
// Quick ways to get test data into Postgres without going through the
// full HTTP API every time (e.g. /register can't produce an official
// or admin account on its own — see authController.register).
// ============================================
const bcrypt = require('bcryptjs');
const { pool } = require('../../db/pool');

const DEFAULT_PASSWORD = 'pass1234';

/**
 * Inserts a user directly. Returns { id, email, password } — password
 * is the PLAIN password (default 'pass1234'), so tests can log in
 * through the real /auth/login endpoint afterwards.
 */
async function createUser({
    name = 'Test User',
    email,
    password = DEFAULT_PASSWORD,
    userType = 'citizen',
    role = 'citizen',
} = {}) {
    const hashed = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
        `INSERT INTO users (name, email, password, user_type, role, is_active, is_verified)
         VALUES ($1, $2, $3, $4, $5, true, true)
         RETURNING id`,
        [name, email, hashed, userType, role]
    );
    return { id: rows[0].id, email, password };
}

module.exports = { createUser, DEFAULT_PASSWORD };
