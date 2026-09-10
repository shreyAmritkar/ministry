// ============================================
// models/User.js
// Raw-SQL data access layer for the `users` table.
// Replaces the Mongoose User model — no ORM, explicit SQL.
// ============================================
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db/pool');

// -- row -> API shape -----------------------------------------------------
// Mirrors the JSON the old Mongoose model produced, so controllers /
// frontend need minimal changes: `_id` instead of `id`, nested
// `address` / `officialDetails` / `avatar` objects, camelCase keys.
function toJSON(row, { withPassword = false } = {}) {
    if (!row) return null;
    const user = {
        _id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        userType: row.user_type,
        role: row.role,
        address: {
            street: row.address_street,
            city: row.address_city,
            state: row.address_state,
            pincode: row.address_pincode,
        },
        officialDetails: {
            designation: row.official_designation,
            employeeId: row.official_employee_id,
            department: row.official_department,
            city: row.official_city,
        },
        avatar: {
            url: row.avatar_url,
            cloudinaryId: row.avatar_cloudinary_id,
        },
        isVerified: row.is_verified,
        verificationToken: row.verification_token,
        verificationTokenExpiry: row.verification_token_expiry,
        passwordResetToken: row.password_reset_token,
        passwordResetExpiry: row.password_reset_expiry,
        lastLogin: row.last_login,
        isActive: row.is_active,
        reportsSubmitted: row.reports_submitted,
        reportsResolved: row.reports_resolved,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
    if (withPassword) user.password = row.password;
    return user;
}

const SELECT_COLUMNS = `
    id, name, email, phone, password, user_type, role,
    address_street, address_city, address_state, address_pincode,
    official_designation, official_employee_id, official_department, official_city,
    avatar_url, avatar_cloudinary_id,
    is_verified, verification_token, verification_token_expiry,
    password_reset_token, password_reset_expiry, last_login, is_active,
    reports_submitted, reports_resolved, created_at, updated_at
`;

async function findById(id, { withPassword = false } = {}) {
    const { rows } = await query(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`, [id]);
    return toJSON(rows[0], { withPassword });
}

async function findByEmail(email, { withPassword = false } = {}) {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`,
        [email.toLowerCase().trim()]
    );
    return toJSON(rows[0], { withPassword });
}

async function findByVerificationToken(hashedToken) {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM users
         WHERE verification_token = $1 AND verification_token_expiry > now()`,
        [hashedToken]
    );
    return toJSON(rows[0]);
}

async function findByPasswordResetToken(hashedToken) {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM users
         WHERE password_reset_token = $1 AND password_reset_expiry > now()`,
        [hashedToken]
    );
    return toJSON(rows[0]);
}

/**
 * List users with optional filters + pagination.
 * filters: { userType, role }
 */
async function findAll(filters = {}, { limit = 20, offset = 0 } = {}) {
    const clauses = [];
    const params = [];
    if (filters.userType) {
        params.push(filters.userType);
        clauses.push(`user_type = $${params.length}`);
    }
    if (filters.role) {
        params.push(filters.role);
        clauses.push(`role = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM users ${where}
         ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
    );
    return rows.map((r) => toJSON(r));
}

async function count(filters = {}) {
    const clauses = [];
    const params = [];
    if (filters.userType) {
        params.push(filters.userType);
        clauses.push(`user_type = $${params.length}`);
    }
    if (filters.role) {
        params.push(filters.role);
        clauses.push(`role = $${params.length}`);
    }
    if (filters.isActive !== undefined) {
        params.push(filters.isActive);
        clauses.push(`is_active = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await query(`SELECT COUNT(*)::int AS count FROM users ${where}`, params);
    return rows[0].count;
}

/**
 * Find officials, optionally scoped to a city / department.
 * (was userSchema.statics.findActiveOfficials)
 */
async function findActiveOfficials(city, department) {
    const clauses = [`user_type = 'official'`, `is_active = true`];
    const params = [];
    if (city) {
        params.push(city);
        clauses.push(`official_city = $${params.length}`);
    }
    if (department) {
        params.push(department);
        clauses.push(`official_department = $${params.length}`);
    }
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM users WHERE ${clauses.join(' AND ')}`,
        params
    );
    return rows.map((r) => toJSON(r));
}

/**
 * Create a new user. Hashes the password (was the `pre('save')` hook).
 */
async function create(data) {
    const hashed = await bcrypt.hash(data.password, 12);
    const { rows } = await query(
        `INSERT INTO users (
            name, email, phone, password, user_type, role,
            address_street, address_city, address_state, address_pincode,
            official_designation, official_employee_id, official_department, official_city,
            is_verified, is_active
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING ${SELECT_COLUMNS}`,
        [
            data.name,
            data.email.toLowerCase().trim(),
            data.phone || null,
            hashed,
            data.userType,
            data.role || null,
            data.address?.street || null,
            data.address?.city || null,
            data.address?.state || null,
            data.address?.pincode || null,
            data.officialDetails?.designation || null,
            data.officialDetails?.employeeId || null,
            data.officialDetails?.department || null,
            data.officialDetails?.city || null,
            data.isVerified ?? false,
            data.isActive ?? true,
        ]
    );
    return toJSON(rows[0]);
}

/**
 * Generic partial update. `updates` uses the same camelCase keys as the
 * API/JSON shape (e.g. { name, phone, address: {...}, isActive }).
 * Password updates go through `updatePassword` (re-hashes).
 */
async function updateById(id, updates) {
    const columnMap = {
        name: 'name',
        phone: 'phone',
        role: 'role',
        isVerified: 'is_verified',
        isActive: 'is_active',
        lastLogin: 'last_login',
        reportsSubmitted: 'reports_submitted',
        reportsResolved: 'reports_resolved',
        verificationToken: 'verification_token',
        verificationTokenExpiry: 'verification_token_expiry',
        passwordResetToken: 'password_reset_token',
        passwordResetExpiry: 'password_reset_expiry',
    };

    const sets = [];
    const params = [];

    for (const [key, column] of Object.entries(columnMap)) {
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
            params.push(updates[key]);
            sets.push(`${column} = $${params.length}`);
        }
    }
    if (updates.address) {
        for (const [field, column] of [
            ['street', 'address_street'], ['city', 'address_city'],
            ['state', 'address_state'], ['pincode', 'address_pincode'],
        ]) {
            if (updates.address[field] !== undefined) {
                params.push(updates.address[field]);
                sets.push(`${column} = $${params.length}`);
            }
        }
    }
    if (updates.avatar) {
        if (updates.avatar.url !== undefined) {
            params.push(updates.avatar.url);
            sets.push(`avatar_url = $${params.length}`);
        }
        if (updates.avatar.cloudinaryId !== undefined) {
            params.push(updates.avatar.cloudinaryId);
            sets.push(`avatar_cloudinary_id = $${params.length}`);
        }
    }
    if (updates.officialDetails) {
        for (const [field, column] of [
            ['designation', 'official_designation'], ['employeeId', 'official_employee_id'],
            ['department', 'official_department'], ['city', 'official_city'],
        ]) {
            if (updates.officialDetails[field] !== undefined) {
                params.push(updates.officialDetails[field]);
                sets.push(`${column} = $${params.length}`);
            }
        }
    }

    if (sets.length === 0) return findById(id);

    params.push(id);
    const { rows } = await query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
         RETURNING ${SELECT_COLUMNS}`,
        params
    );
    return toJSON(rows[0]);
}

async function updatePassword(id, newPlainPassword) {
    const hashed = await bcrypt.hash(newPlainPassword, 12);
    const { rows } = await query(
        `UPDATE users SET password = $1 WHERE id = $2 RETURNING ${SELECT_COLUMNS}`,
        [hashed, id]
    );
    return toJSON(rows[0]);
}

async function comparePassword(candidatePassword, passwordHash) {
    return bcrypt.compare(candidatePassword, passwordHash);
}

/**
 * Generate + persist an email-verification token.
 * Returns the *raw* token (send this in the email); the hashed version
 * is what's stored, matching the old `createVerificationToken` method.
 */
async function createVerificationToken(id) {
    const token = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await query(
        `UPDATE users SET verification_token = $1, verification_token_expiry = $2 WHERE id = $3`,
        [hashed, expiry, id]
    );
    return token;
}

async function setPasswordResetToken(id) {
    const token = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await query(
        `UPDATE users SET password_reset_token = $1, password_reset_expiry = $2 WHERE id = $3`,
        [hashed, expiry, id]
    );
    return token;
}

async function clearPasswordResetToken(id) {
    await query(
        `UPDATE users SET password_reset_token = NULL, password_reset_expiry = NULL WHERE id = $1`,
        [id]
    );
}

async function markVerified(id) {
    const { rows } = await query(
        `UPDATE users SET is_verified = true, verification_token = NULL, verification_token_expiry = NULL
         WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
        [id]
    );
    return toJSON(rows[0]);
}

async function touchLastLogin(id) {
    await query(`UPDATE users SET last_login = now() WHERE id = $1`, [id]);
}

module.exports = {
    toJSON,
    findById,
    findByEmail,
    findByVerificationToken,
    findByPasswordResetToken,
    findAll,
    count,
    findActiveOfficials,
    create,
    updateById,
    updatePassword,
    comparePassword,
    createVerificationToken,
    setPasswordResetToken,
    clearPasswordResetToken,
    markVerified,
    touchLastLogin,
};
