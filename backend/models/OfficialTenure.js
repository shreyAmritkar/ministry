// ============================================
// models/OfficialTenure.js
// Raw-SQL data access layer for `official_tenures`.
// Replaces the Mongoose OfficialTenure model.
// ============================================
const { query } = require('../db/pool');
const User = require('./User');

function toJSON(row) {
    if (!row) return null;
    const now = new Date();
    const start = new Date(row.start_date);
    const end = row.end_date ? new Date(row.end_date) : null;
    return {
        _id: row.id,
        official: row.official_id,
        city: row.city,
        position: row.position,
        department: row.department,
        startDate: row.start_date,
        endDate: row.end_date,
        isActive: row.is_active,
        terminationReason: row.termination_reason,
        contactInfo: {
            phone: row.contact_phone,
            email: row.contact_email,
            officeAddress: row.contact_office_address,
        },
        responsibilities: row.responsibilities || [],
        metrics: {
            totalReportsReceived: row.metrics_total_reports,
            reportsResolved: row.metrics_resolved_reports,
            averageResolutionTime: row.metrics_avg_resolution_days,
            rating: row.metrics_rating === null ? 0 : Number(row.metrics_rating),
        },
        appointedBy: row.appointed_by,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // was a virtual on the Mongoose schema
        isCurrentlyActive: row.is_active && start <= now && (!end || end >= now),
    };
}

const SELECT_COLUMNS = `
    id, official_id, city, position, department, start_date, end_date, is_active,
    termination_reason, contact_phone, contact_email, contact_office_address,
    responsibilities, metrics_total_reports, metrics_resolved_reports,
    metrics_avg_resolution_days, metrics_rating, appointed_by, notes,
    created_at, updated_at
`;

async function findById(id) {
    const { rows } = await query(`SELECT ${SELECT_COLUMNS} FROM official_tenures WHERE id = $1`, [id]);
    return toJSON(rows[0]);
}

/** Attaches a populated `official` object, mirroring `.populate('official', ...)` */
async function findByIdWithOfficial(id) {
    const tenure = await findById(id);
    if (!tenure) return null;
    const official = await User.findById(tenure.official);
    tenure.official = official
        ? { _id: official._id, name: official.name, email: official.email, phone: official.phone, officialDetails: official.officialDetails }
        : null;
    return tenure;
}

async function findAll(filters = {}, { limit = 20, offset = 0 } = {}) {
    const { where, params } = buildFilter(filters);
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM official_tenures ${where}
         ORDER BY start_date DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
    );
    return rows.map(toJSON);
}

async function count(filters = {}) {
    const { where, params } = buildFilter(filters);
    const { rows } = await query(`SELECT COUNT(*)::int AS count FROM official_tenures ${where}`, params);
    return rows[0].count;
}

function buildFilter(filters) {
    const clauses = [];
    const params = [];
    if (filters.city) {
        params.push(filters.city);
        clauses.push(`city = $${params.length}`);
    }
    if (filters.isActive !== undefined) {
        params.push(filters.isActive);
        clauses.push(`is_active = $${params.length}`);
    }
    if (filters.position) {
        params.push(filters.position);
        clauses.push(`position = $${params.length}`);
    }
    if (filters.official) {
        params.push(filters.official);
        clauses.push(`official_id = $${params.length}`);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function findByOfficial(officialId) {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM official_tenures WHERE official_id = $1 ORDER BY start_date DESC`,
        [officialId]
    );
    return rows.map(toJSON);
}

/**
 * The official currently responsible for a city.
 * (was OfficialTenure.findCurrentOfficialForCity)
 */
async function findCurrentOfficialForCity(city) {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM official_tenures
         WHERE city = $1 AND is_active = true
           AND start_date <= now()
           AND (end_date IS NULL OR end_date >= now())
         ORDER BY start_date DESC LIMIT 1`,
        [city]
    );
    return findByIdWithOfficialFromRow(rows[0]);
}

/**
 * The official responsible for a city on a specific historical date.
 * (was OfficialTenure.findOfficialAtDate)
 */
async function findOfficialAtDate(city, date) {
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM official_tenures
         WHERE city = $1
           AND start_date <= $2
           AND (end_date IS NULL OR end_date >= $2)
         ORDER BY start_date DESC LIMIT 1`,
        [city, date]
    );
    return findByIdWithOfficialFromRow(rows[0]);
}

async function findByIdWithOfficialFromRow(row) {
    if (!row) return null;
    const tenure = toJSON(row);
    const official = await User.findById(tenure.official);
    tenure.official = official
        ? { _id: official._id, name: official.name, email: official.email, phone: official.phone, officialDetails: official.officialDetails }
        : null;
    return tenure;
}

/** (was TenureService.checkOverlappingTenures) */
async function findOverlapping(city, startDate, endDate) {
    const searchEndDate = endDate || new Date('2099-12-31');
    const { rows } = await query(
        `SELECT ${SELECT_COLUMNS} FROM official_tenures
         WHERE city = $1
           AND start_date <= $2
           AND (end_date IS NULL OR end_date >= $3)
         LIMIT 1`,
        [city, searchEndDate, startDate]
    );
    return toJSON(rows[0]);
}

async function create(data) {
    const startDate = new Date(data.startDate);
    const now = new Date();
    const endDate = data.endDate ? new Date(data.endDate) : null;
    // was the pre('save') hook computing isActive from the dates
    const isActive = endDate && endDate < now ? false : startDate <= now;

    const { rows } = await query(
        `INSERT INTO official_tenures (
            official_id, city, position, department, start_date, end_date, is_active,
            contact_phone, contact_email, contact_office_address, responsibilities,
            appointed_by, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING ${SELECT_COLUMNS}`,
        [
            data.official,
            data.city.toLowerCase(),
            data.position,
            data.department,
            startDate,
            endDate,
            data.isActive ?? isActive,
            data.contactInfo?.phone || null,
            data.contactInfo?.email || null,
            data.contactInfo?.officeAddress || null,
            data.responsibilities || [],
            data.appointedBy || null,
            data.notes || null,
        ]
    );
    return toJSON(rows[0]);
}

/** Generic partial update, used by tenureController.updateTenure */
async function updateById(id, updates) {
    const columnMap = {
        position: 'position',
        department: 'department',
        isActive: 'is_active',
        terminationReason: 'termination_reason',
        notes: 'notes',
        responsibilities: 'responsibilities',
    };
    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(columnMap)) {
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
            params.push(updates[key]);
            sets.push(`${column} = $${params.length}`);
        }
    }
    if (updates.startDate !== undefined) {
        params.push(new Date(updates.startDate));
        sets.push(`start_date = $${params.length}`);
    }
    if (updates.endDate !== undefined) {
        params.push(updates.endDate ? new Date(updates.endDate) : null);
        sets.push(`end_date = $${params.length}`);
    }
    if (updates.contactInfo) {
        if (updates.contactInfo.phone !== undefined) {
            params.push(updates.contactInfo.phone);
            sets.push(`contact_phone = $${params.length}`);
        }
        if (updates.contactInfo.email !== undefined) {
            params.push(updates.contactInfo.email);
            sets.push(`contact_email = $${params.length}`);
        }
        if (updates.contactInfo.officeAddress !== undefined) {
            params.push(updates.contactInfo.officeAddress);
            sets.push(`contact_office_address = $${params.length}`);
        }
    }

    if (sets.length === 0) return findById(id);

    params.push(id);
    const { rows } = await query(
        `UPDATE official_tenures SET ${sets.join(', ')} WHERE id = $${params.length}
         RETURNING ${SELECT_COLUMNS}`,
        params
    );
    return toJSON(rows[0]);
}

/** (was tenureSchema.methods.endTenure) */
async function endTenure(id, reason, endDate = new Date()) {
    const { rows } = await query(
        `UPDATE official_tenures
         SET is_active = false, end_date = $1, termination_reason = $2
         WHERE id = $3 RETURNING ${SELECT_COLUMNS}`,
        [endDate, reason, id]
    );
    return toJSON(rows[0]);
}

/**
 * Recompute totalReportsReceived / reportsResolved / averageResolutionTime
 * from the `reports` table. (was tenureSchema.methods.updateMetrics)
 */
async function updateMetrics(id) {
    const { rows: statRows } = await query(
        `SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'Solved')::int AS solved,
            COALESCE(AVG(
                EXTRACT(EPOCH FROM (
                    COALESCE(resolution_resolved_at, now()) - created_at
                )) / 86400.0
            ) FILTER (WHERE status = 'Solved'), 0) AS avg_days
         FROM reports WHERE official_tenure_id = $1`,
        [id]
    );
    const { total, solved, avg_days } = statRows[0];

    const { rows } = await query(
        `UPDATE official_tenures
         SET metrics_total_reports = $1,
             metrics_resolved_reports = $2,
             metrics_avg_resolution_days = $3
         WHERE id = $4
         RETURNING ${SELECT_COLUMNS}`,
        [total, solved, Math.round(Number(avg_days)), id]
    );
    return toJSON(rows[0]);
}

async function deleteById(id) {
    await query(`DELETE FROM official_tenures WHERE id = $1`, [id]);
}

async function aggregateByPosition() {
    const { rows } = await query(
        `SELECT position AS _id, COUNT(*)::int AS count,
                COUNT(*) FILTER (WHERE is_active)::int AS active
         FROM official_tenures GROUP BY position ORDER BY count DESC`
    );
    return rows;
}

/**
 * Original Mongoose code aggregated by a `$zone` field that no longer
 * exists (leftover from the ward -> city rename). Grouping by city here
 * instead, since that's the real jurisdiction field.
 */
async function aggregateByCity() {
    const { rows } = await query(
        `SELECT city AS _id, COUNT(*)::int AS count,
                COUNT(*) FILTER (WHERE is_active)::int AS active
         FROM official_tenures GROUP BY city ORDER BY count DESC`
    );
    return rows;
}

async function findCompletedDurations() {
    const { rows } = await query(
        `SELECT start_date, end_date FROM official_tenures
         WHERE is_active = false AND end_date IS NOT NULL`
    );
    return rows;
}

module.exports = {
    toJSON,
    findById,
    findByIdWithOfficial,
    findAll,
    count,
    findByOfficial,
    findCurrentOfficialForCity,
    findOfficialAtDate,
    findOverlapping,
    create,
    updateById,
    endTenure,
    updateMetrics,
    deleteById,
    aggregateByPosition,
    aggregateByCity,
    findCompletedDurations,
};
