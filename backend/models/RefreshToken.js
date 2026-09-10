// ============================================
// models/RefreshToken.js
// Raw-SQL data access layer for `refresh_tokens`.
//
// Design: the ACCESS token is a short-lived, stateless JWT — it is
// never written to the database anywhere. Only the REFRESH token is
// persisted here, and only as a SHA-256 hash (never the raw value),
// so a database leak can't be replayed as a live session. This table
// is what makes revocation (logout, rotation, "log out everywhere")
// possible at all.
// ============================================
const crypto = require('crypto');
const { query } = require('../db/pool');

function hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateRawToken() {
    return crypto.randomBytes(40).toString('hex');
}

/**
 * Creates a new refresh token for a user and returns the RAW value —
 * that's what gets sent to the client. Only its hash is stored.
 */
async function issue(userId, { expiresInDays = 30, userAgent = null } = {}) {
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    await query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [userId, tokenHash, expiresAt, userAgent]
    );

    return rawToken;
}

/**
 * Looks up a refresh token by its RAW value (hashes it first).
 * Returns null if it doesn't exist, is revoked, or has expired —
 * callers should treat all three cases identically (reject the refresh).
 */
async function findValid(rawToken) {
    const tokenHash = hashToken(rawToken);
    const { rows } = await query(
        `SELECT id, user_id, token_hash, expires_at, revoked_at
         FROM refresh_tokens
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
        [tokenHash]
    );
    if (!rows[0]) return null;
    return { id: rows[0].id, userId: rows[0].user_id };
}

/** Revokes one refresh token by its raw value (used on logout). */
async function revoke(rawToken) {
    const tokenHash = hashToken(rawToken);
    await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash]);
}

/**
 * Rotation: revoke the old token, pointing at the new one for audit
 * purposes, in the same statement.
 */
async function rotate(oldRawToken, newRawToken) {
    const oldHash = hashToken(oldRawToken);
    const newHash = hashToken(newRawToken);
    await query(
        `UPDATE refresh_tokens SET revoked_at = now(), replaced_by_hash = $1 WHERE token_hash = $2`,
        [newHash, oldHash]
    );
}

/** "Log out everywhere" — revokes every active refresh token for a user. */
async function revokeAllForUser(userId) {
    await query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
    );
}

/** Housekeeping — run from a cron job, not on the request path. */
async function deleteExpired() {
    const { rowCount } = await query(
        `DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days'`
    );
    return rowCount;
}

module.exports = {
    issue,
    findValid,
    revoke,
    rotate,
    revokeAllForUser,
    deleteExpired,
};
