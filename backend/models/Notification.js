// ============================================
// models/Notification.js
// Raw-SQL data access layer for `notifications` (in-app notifications).
// Replaces the Mongoose Notification model.
// ============================================
const { query } = require('../db/pool');
const User = require('./User');

function toJSON(row) {
    if (!row) return null;
    return {
        _id: row.id,
        recipient: row.recipient,
        type: row.type,
        title: row.title,
        message: row.message,
        data: row.data || {},
        priority: row.priority,
        read: row.read,
        readAt: row.read_at,
        createdAt: row.created_at,
    };
}

const SELECT_COLUMNS = `id, recipient, type, title, message, data, priority, read, read_at, created_at`;

async function create(data) {
    const { rows } = await query(
        `INSERT INTO notifications (recipient, type, title, message, data, priority)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6)
         RETURNING ${SELECT_COLUMNS}`,
        [data.recipient, data.type, data.title, data.message, JSON.stringify(data.data || {}), data.priority || 'normal']
    );
    return toJSON(rows[0]);
}

/** Mirrors `.populate('recipient', 'name email')` */
async function populateRecipient(notification) {
    if (!notification) return notification;
    const user = await User.findById(notification.recipient);
    notification.recipient = user ? { _id: user._id, name: user.name, email: user.email } : null;
    return notification;
}

async function findByRecipient(userId, { unreadOnly = false, limit = 20, offset = 0 } = {}) {
    const clauses = ['recipient = $1'];
    const params = [userId];
    if (unreadOnly) clauses.push('read = false');
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM notifications WHERE ${clauses.join(' AND ')}
         ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
    );
    return rows.map(toJSON);
}

async function count(userId, { unreadOnly = false } = {}) {
    const clauses = ['recipient = $1'];
    const params = [userId];
    if (unreadOnly) clauses.push('read = false');
    const { rows } = await query(
        `SELECT COUNT(*)::int AS count FROM notifications WHERE ${clauses.join(' AND ')}`,
        params
    );
    return rows[0].count;
}

async function findUnread(userId, limit = 20) {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM notifications WHERE recipient = $1 AND read = false
         ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
    );
    return rows.map(toJSON);
}

async function markAsRead(id, userId) {
    const { rows } = await query(
        `UPDATE notifications SET read = true, read_at = now()
         WHERE id = $1 AND recipient = $2 RETURNING ${SELECT_COLUMNS}`,
        [id, userId]
    );
    return toJSON(rows[0]);
}

async function markAllAsRead(userId) {
    await query(
        `UPDATE notifications SET read = true, read_at = now() WHERE recipient = $1 AND read = false`,
        [userId]
    );
}

async function deleteOne(id, userId) {
    const { rows } = await query(
        `DELETE FROM notifications WHERE id = $1 AND recipient = $2 RETURNING id`,
        [id, userId]
    );
    return rows[0] ? { _id: rows[0].id } : null;
}

/** Replaces Mongo's `expireAfterSeconds: 2592000` TTL index — call from a cron job. */
async function deleteOlderThan30Days() {
    const { rowCount } = await query(`DELETE FROM notifications WHERE created_at < now() - interval '30 days'`);
    return rowCount;
}

module.exports = {
    toJSON,
    create,
    populateRecipient,
    findByRecipient,
    count,
    findUnread,
    markAsRead,
    markAllAsRead,
    deleteOne,
    deleteOlderThan30Days,
};
