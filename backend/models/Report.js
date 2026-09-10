// ============================================
// models/Report.js
// Raw-SQL data access layer for `reports` (+ its child tables:
// report_status_history, report_notifications, report_upvotes).
// Replaces the Mongoose Report model.
// ============================================
const { query, withTransaction } = require('../db/pool');
const User = require('./User');
const OfficialTenure = require('./OfficialTenure');

function toJSON(row) {
    if (!row) return null;
    const createdAt = new Date(row.created_at);
    const resolvedAt = row.resolution_resolved_at ? new Date(row.resolution_resolved_at) : null;
    const durationMs = (row.status === 'Solved' && resolvedAt ? resolvedAt : new Date()) - createdAt;

    return {
        _id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        location: {
            type: 'Point',
            // ST_AsGeoJSON is selected as location_geojson by the query helpers below
            coordinates: row.location_geojson
                ? JSON.parse(row.location_geojson).coordinates
                : [row.longitude, row.latitude],
        },
        address: {
            street: row.address_street,
            area: row.address_area,
            ward: row.address_ward,
            city: row.address_city,
            pincode: row.address_pincode,
        },
        mediaType: row.media_type,
        mediaUrl: row.media_url,
        cloudinaryId: row.cloudinary_id,
        gridfsId: row.gridfs_id,
        status: row.status,
        priority: row.priority,
        reportedBy: row.reported_by,
        assignedTo: row.assigned_to,
        official_tenure_id: row.official_tenure_id,
        resolutionDetails: {
            description: row.resolution_description,
            resolvedBy: row.resolution_resolved_by,
            resolvedAt: row.resolution_resolved_at,
            verificationMedia: row.resolution_verification_media || [],
            verificationStatus: row.resolution_verification_status,
            verificationDeadline: row.resolution_verification_deadline,
            verifiedBy: row.resolution_verified_by,
            verifiedAt: row.resolution_verified_at,
            verificationComment: row.resolution_verification_comment,
            reminderSentAt: row.resolution_reminder_sent_at,
        },
        aiReasoning: row.ai_reasoning,
        aiProcessedAt: row.ai_processed_at,
        upvotes: row.upvotes,
        views: row.views,
        isPublic: row.is_public,
        isArchived: row.is_archived,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        durationDays: Math.ceil(durationMs / (1000 * 60 * 60 * 24)), // was a virtual
    };
}

const SELECT_COLUMNS = `
    id, title, description, category,
    ST_AsGeoJSON(location) AS location_geojson,
    address_street, address_area, address_ward, address_city, address_pincode,
    media_type, media_url, cloudinary_id, gridfs_id,
    status, priority, reported_by, assigned_to, official_tenure_id,
    resolution_description, resolution_resolved_by, resolution_resolved_at,
    resolution_verification_media, resolution_verification_status,
    resolution_verification_deadline, resolution_verified_by, resolution_verified_at,
    resolution_verification_comment, resolution_reminder_sent_at,
    ai_reasoning, ai_processed_at, upvotes, views, is_public, is_archived,
    created_at, updated_at
`;

// -- populate helpers -------------------------------------------------
async function populateUsers(report, fields = 'name email') {
    if (!report) return report;
    const wanted = fields.split(' ');
    const pick = (u) => {
        if (!u) return null;
        const out = { _id: u._id };
        wanted.forEach((f) => {
            if (f === 'officialDetails') out.officialDetails = u.officialDetails;
            else if (u[f] !== undefined) out[f] = u[f];
        });
        return out;
    };
    if (report.reportedBy) report.reportedBy = pick(await User.findById(report.reportedBy));
    if (report.assignedTo) report.assignedTo = pick(await User.findById(report.assignedTo));
    return report;
}

async function populateTenure(report, fields = 'position city') {
    if (!report || !report.official_tenure_id) return report;
    const tenure = await OfficialTenure.findById(report.official_tenure_id);
    if (!tenure) return report;
    const wanted = fields.split(' ');
    const out = { _id: tenure._id };
    wanted.forEach((f) => { if (tenure[f] !== undefined) out[f] = tenure[f]; });
    report.official_tenure_id = out;
    return report;
}

async function attachStatusHistory(report) {
    if (!report) return report;
    const { rows } = await query(
        `SELECT status, updated_by, comment, "timestamp"
         FROM report_status_history WHERE report_id = $1 ORDER BY "timestamp" ASC`,
        [report._id]
    );
    report.statusHistory = rows.map((r) => ({
        status: r.status, updatedBy: r.updated_by, comment: r.comment, timestamp: r.timestamp,
    }));
    return report;
}

// -- reads --------------------------------------------------------------
async function findById(id) {
    const { rows } = await query(`SELECT ${SELECT_COLUMNS} FROM reports WHERE id = $1`, [id]);
    return toJSON(rows[0]);
}

function buildFilter(filters, startParams = []) {
    const clauses = [];
    const params = [...startParams];
    if (filters.status) {
        params.push(filters.status);
        clauses.push(`status = $${params.length}`);
    }
    if (filters.category) {
        params.push(filters.category);
        clauses.push(`category = $${params.length}`);
    }
    if (filters.city) {
        params.push(filters.city);
        clauses.push(`address_city = $${params.length}`);
    }
    if (filters.priority) {
        params.push(filters.priority);
        clauses.push(`priority = $${params.length}`);
    }
    if (filters.reportedBy) {
        params.push(filters.reportedBy);
        clauses.push(`reported_by = $${params.length}`);
    }
    if (filters.assignedTo) {
        params.push(filters.assignedTo);
        clauses.push(`assigned_to = $${params.length}`);
    }
    if (filters.official_tenure_id_in) {
        params.push(filters.official_tenure_id_in);
        clauses.push(`official_tenure_id = ANY($${params.length}::uuid[])`);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function findAll(filters = {}, { limit = 20, offset = 0, sort = 'created_at DESC' } = {}) {
    const { where, params } = buildFilter(filters);
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM reports ${where}
         ORDER BY ${sort} LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
    );
    return rows.map(toJSON);
}

async function count(filters = {}) {
    const { where, params } = buildFilter(filters);
    const { rows } = await query(`SELECT COUNT(*)::int AS count FROM reports ${where}`, params);
    return rows[0].count;
}

/**
 * Reports assigned to an official, sorted like the original
 * `.sort({ status: 1, priority: -1, createdAt: -1 })`.
 */
async function findByAssignedTo(officialId) {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM reports WHERE assigned_to = $1
         ORDER BY status ASC,
                  CASE priority WHEN 'Critical' THEN 4 WHEN 'High' THEN 3
                                WHEN 'Medium' THEN 2 WHEN 'Low' THEN 1 ELSE 0 END DESC,
                  created_at DESC`,
        [officialId]
    );
    return rows.map(toJSON);
}

/**
 * Geospatial "nearby" search using PostGIS ST_DWithin (replaces $near).
 * `maxDistance` is in meters, same as the Mongo 2dsphere query.
 */
async function findNearby(longitude, latitude, maxDistance = 5000, filters = {}) {
    const { where, params } = buildFilter(filters, [longitude, latitude, maxDistance]);
    const distanceWhere = `ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)`;
    const fullWhere = where ? `${where} AND ${distanceWhere}` : `WHERE ${distanceWhere}`;

    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS}, ST_Distance(location, ST_MakePoint($1, $2)::geography) AS distance_m
         FROM reports ${fullWhere}
         ORDER BY distance_m ASC LIMIT 50`,
        params
    );
    return rows.map(toJSON);
}

async function findExpiredPendingVerification() {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM reports
         WHERE resolution_verification_status = 'pending_verification'
           AND resolution_verification_deadline <= now()`
    );
    return rows.map(toJSON);
}

async function findPendingVerification() {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM reports
         WHERE resolution_verification_status = 'pending_verification'`
    );
    return rows.map(toJSON);
}

// -- writes ---------------------------------------------------------------
async function create(data) {
    const [longitude, latitude] = data.location.coordinates;
    return withTransaction(async (client) => {
        const { rows } = await client.query(
            `INSERT INTO reports (
                title, description, category, location,
                address_street, address_area, address_ward, address_city, address_pincode,
                media_type, media_url, cloudinary_id, gridfs_id,
                status, priority, reported_by, assigned_to, official_tenure_id
             ) VALUES (
                $1,$2,$3, ST_SetSRID(ST_MakePoint($4,$5),4326)::geography,
                $6,$7,$8,$9,$10, $11,$12,$13,$14, $15,$16,$17,$18,$19
             ) RETURNING ${SELECT_COLUMNS}`,
            [
                data.title, data.description, data.category,
                longitude, latitude,
                data.address?.street || null, data.address?.area || null,
                data.address?.ward || null, data.address?.city, data.address?.pincode || null,
                data.mediaType || 'none', data.mediaUrl || null, data.cloudinaryId || null,
                data.gridfsId || null,
                data.status || 'Pending', data.priority || 'Medium',
                data.reportedBy, data.assignedTo || null, data.official_tenure_id || null,
            ]
        );
        const report = rows[0];
        await client.query(
            `INSERT INTO report_status_history (report_id, status) VALUES ($1, $2)`,
            [report.id, report.status]
        );
        return toJSON(report);
    });
}

async function incrementViews(id) {
    const { rows } = await query(
        `UPDATE reports SET views = views + 1 WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
        [id]
    );
    return toJSON(rows[0]);
}

/**
 * Change status + append a row to report_status_history.
 * (was reportSchema.methods.updateStatus)
 */
async function updateStatus(id, newStatus, userId, comment) {
    return withTransaction(async (client) => {
        const sets = [`status = $1`];
        const params = [newStatus];
        if (newStatus === 'Solved') {
            params.push(new Date());
            sets.push(`resolution_resolved_at = $${params.length}`);
            params.push(userId);
            sets.push(`resolution_resolved_by = $${params.length}`);
        }
        params.push(id);
        const { rows } = await client.query(
            `UPDATE reports SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${SELECT_COLUMNS}`,
            params
        );
        await client.query(
            `INSERT INTO report_status_history (report_id, status, updated_by, comment) VALUES ($1,$2,$3,$4)`,
            [id, newStatus, userId || null, comment || null]
        );
        return toJSON(rows[0]);
    });
}

/** Official claims a report resolved (was reportController.markAsResolved) */
async function setResolutionClaim(id, { description, resolvedBy, verificationMedia = [] }) {
    const { rows } = await query(
        `UPDATE reports SET
            status = 'Reported',
            resolution_description = $1,
            resolution_resolved_by = $2,
            resolution_resolved_at = now(),
            resolution_verification_media = $3::jsonb,
            resolution_verification_status = 'pending_verification'
         WHERE id = $4 RETURNING ${SELECT_COLUMNS}`,
        [description, resolvedBy, JSON.stringify(verificationMedia), id]
    );
    return toJSON(rows[0]);
}

/** Reporter verifies/rejects a resolution claim */
async function setVerification(id, { verified, userId, comment }) {
    if (verified) {
        const { rows } = await query(
            `UPDATE reports SET
                status = 'Solved',
                resolution_verification_status = 'verified',
                resolution_verified_by = $1,
                resolution_verified_at = now(),
                resolution_verification_comment = $2
             WHERE id = $3 RETURNING ${SELECT_COLUMNS}`,
            [userId, comment || 'Verified by reporter', id]
        );
        return toJSON(rows[0]);
    }
    const { rows } = await query(
        `UPDATE reports SET
            status = 'In_Progress',
            resolution_verification_status = 'rejected',
            resolution_verification_comment = $1
         WHERE id = $2 RETURNING ${SELECT_COLUMNS}`,
        [comment || 'Resolution rejected by reporter', id]
    );
    return toJSON(rows[0]);
}

async function autoVerify(id) {
    const { rows } = await query(
        `UPDATE reports SET
            status = 'Solved',
            resolution_verification_status = 'auto_verified',
            resolution_verified_at = now(),
            resolution_verification_comment = 'Auto-verified: No response from reporter within 2 days'
         WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
        [id]
    );
    return toJSON(rows[0]);
}

async function setVerificationDeadline(id, deadline) {
    await query(
        `UPDATE reports SET
            resolution_verification_deadline = $1,
            resolution_verification_status = 'pending_verification',
            resolution_reminder_sent_at = NULL
         WHERE id = $2`,
        [deadline, id]
    );
}

async function setReminderSentAt(id, when = new Date()) {
    await query(`UPDATE reports SET resolution_reminder_sent_at = $1 WHERE id = $2`, [when, id]);
}

async function addReportNotification(reportId, { type, sentTo, sentAt = new Date() }) {
    await query(
        `INSERT INTO report_notifications (report_id, type, sent_at, sent_to) VALUES ($1,$2,$3,$4)`,
        [reportId, type, sentAt, sentTo]
    );
}

/**
 * Add an upvote, idempotently (mirrors the Mongoose `.includes()` guard).
 * Returns the new upvote count.
 */
async function addUpvote(reportId, userId) {
    return withTransaction(async (client) => {
        const inserted = await client.query(
            `INSERT INTO report_upvotes (report_id, user_id) VALUES ($1,$2)
             ON CONFLICT (report_id, user_id) DO NOTHING RETURNING report_id`,
            [reportId, userId]
        );
        if (inserted.rowCount > 0) {
            await client.query(`UPDATE reports SET upvotes = upvotes + 1 WHERE id = $1`, [reportId]);
        }
        const { rows } = await client.query(`SELECT upvotes FROM reports WHERE id = $1`, [reportId]);
        return rows[0]?.upvotes ?? 0;
    });
}

async function assignTo(id, officialId, tenureId) {
    const { rows } = await query(
        `UPDATE reports SET assigned_to = $1, official_tenure_id = $2 WHERE id = $3
         RETURNING ${SELECT_COLUMNS}`,
        [officialId, tenureId, id]
    );
    return toJSON(rows[0]);
}

async function deleteById(id) {
    await query(`DELETE FROM reports WHERE id = $1`, [id]);
}

// -- aggregations (dashboard / scorecards) --------------------------------
async function countByOfficialTenureIds(tenureIds) {
    const { rows } = await query(
        `SELECT status AS _id, COUNT(*)::int AS count
         FROM reports WHERE official_tenure_id = ANY($1::uuid[]) GROUP BY status`,
        [tenureIds]
    );
    return rows;
}

async function countAllByStatus() {
    const { rows } = await query(`SELECT status AS _id, COUNT(*)::int AS count FROM reports GROUP BY status`);
    return rows;
}

async function countAllByCategory() {
    const { rows } = await query(
        `SELECT category AS _id, COUNT(*)::int AS count FROM reports GROUP BY category ORDER BY count DESC`
    );
    return rows;
}

async function categoryBreakdownForTenures(tenureIds) {
    const { rows } = await query(
        `SELECT category AS _id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'Solved')::int AS solved
         FROM reports WHERE official_tenure_id = ANY($1::uuid[])
         GROUP BY category ORDER BY total DESC`,
        [tenureIds]
    );
    return rows.map((r) => ({
        category: r._id, total: r.total, solved: r.solved,
        percentage: r.total > 0 ? (r.solved / r.total) * 100 : 0,
    }));
}

async function monthlyTrendForTenures(tenureIds, sinceDate) {
    const { rows } = await query(
        `SELECT date_trunc('month', created_at) AS month,
                COUNT(*)::int AS reported,
                COUNT(*) FILTER (WHERE status = 'Solved')::int AS solved
         FROM reports
         WHERE official_tenure_id = ANY($1::uuid[]) AND created_at >= $2
         GROUP BY month ORDER BY month ASC`,
        [tenureIds, sinceDate]
    );
    return rows.map((r) => ({
        _id: { year: r.month.getFullYear(), month: r.month.getMonth() + 1 },
        reported: r.reported, solved: r.solved,
    }));
}

async function resolvedCountForTenures(tenureIds) {
    const { rows } = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'Solved')::int AS solved
         FROM reports WHERE official_tenure_id = ANY($1::uuid[])`,
        [tenureIds]
    );
    return rows[0];
}

module.exports = {
    toJSON,
    findById,
    findAll,
    count,
    findByAssignedTo,
    findNearby,
    findExpiredPendingVerification,
    findPendingVerification,
    create,
    incrementViews,
    updateStatus,
    setResolutionClaim,
    setVerification,
    autoVerify,
    setVerificationDeadline,
    setReminderSentAt,
    addReportNotification,
    addUpvote,
    assignTo,
    deleteById,
    countByOfficialTenureIds,
    countAllByStatus,
    countAllByCategory,
    categoryBreakdownForTenures,
    monthlyTrendForTenures,
    resolvedCountForTenures,
    populateUsers,
    populateTenure,
    attachStatusHistory,
};
