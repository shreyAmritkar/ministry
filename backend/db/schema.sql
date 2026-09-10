-- ============================================================
-- CivicTrack — PostgreSQL schema
-- Replaces the Mongoose/MongoDB models in models/*.js
-- Run once against a fresh database:
--   psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS postgis;      -- geography type + ST_DWithin/ST_Distance

-- ------------------------------------------------------------
-- users  (was models/User.js)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
    email                       TEXT NOT NULL UNIQUE,
    phone                       TEXT,
    password                    TEXT NOT NULL,
    user_type                   TEXT NOT NULL CHECK (user_type IN ('citizen', 'official')),
    role                        TEXT CHECK (role IN ('admin', 'moderator', 'citizen', 'official')),

    -- Citizen address (was `address` sub-doc)
    address_street              TEXT,
    address_city                TEXT,
    address_state               TEXT,
    address_pincode             TEXT,

    -- Official-only details (was `officialDetails` sub-doc)
    official_designation        TEXT CHECK (official_designation IN
                                   ('Mayor', 'Municipal Commissioner', 'Deputy Commissioner',
                                    'Engineer', 'Health Officer', 'Other')),
    official_employee_id        TEXT,
    official_department         TEXT CHECK (official_department IN
                                   ('Administration', 'Engineering', 'Health', 'Sanitation',
                                    'Water Supply', 'Roads', 'Finance', 'Other')),
    official_city                TEXT,   -- used by assignment/scorecard lookups

    -- Profile / security / metadata
    avatar_url                  TEXT,
    avatar_cloudinary_id        TEXT,
    is_verified                 BOOLEAN NOT NULL DEFAULT false,
    verification_token          TEXT,
    verification_token_expiry   TIMESTAMPTZ,
    password_reset_token        TEXT,
    password_reset_expiry       TIMESTAMPTZ,
    last_login                  TIMESTAMPTZ,
    is_active                   BOOLEAN NOT NULL DEFAULT true,
    reports_submitted           INTEGER NOT NULL DEFAULT 0,
    reports_resolved            INTEGER NOT NULL DEFAULT 0,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_type_active ON users (user_type, is_active);
CREATE INDEX IF NOT EXISTS idx_users_official_department ON users (official_department);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users (verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token);

-- ------------------------------------------------------------
-- official_tenures  (was models/OfficialTenure.js)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_tenures (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    official_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    city                    TEXT NOT NULL,   -- always stored lower-cased, see models/OfficialTenure.js
    position                TEXT NOT NULL CHECK (position IN
                               ('Mayor', 'Municipal Commissioner', 'CEO - Municipal Corporation',
                                'Chairperson - Nagar Parishad', 'Deputy Mayor',
                                'Head of Public Works', 'Other')),
    department              TEXT NOT NULL CHECK (department IN
                               ('Administration', 'Engineering', 'Health & Sanitation',
                                'Water Supply', 'Public Works', 'Finance & Taxation', 'Other')),

    start_date               TIMESTAMPTZ NOT NULL,
    end_date                 TIMESTAMPTZ,
    is_active                BOOLEAN NOT NULL DEFAULT true,
    termination_reason       TEXT CHECK (termination_reason IN
                               ('Transfer', 'Resignation', 'Retirement', 'Completion',
                                'Termination', 'Other')),

    contact_phone            TEXT,
    contact_email            TEXT,
    contact_office_address   TEXT,
    responsibilities         TEXT[] NOT NULL DEFAULT '{}',

    geo_boundaries           GEOGRAPHY(MultiPolygon, 4326),

    metrics_total_reports    INTEGER NOT NULL DEFAULT 0,
    metrics_resolved_reports INTEGER NOT NULL DEFAULT 0,
    metrics_avg_resolution_days INTEGER NOT NULL DEFAULT 0,
    metrics_rating           NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (metrics_rating BETWEEN 0 AND 5),

    appointed_by             UUID REFERENCES users(id),
    notes                    TEXT,

    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT end_after_start CHECK (end_date IS NULL OR end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_tenures_official_active ON official_tenures (official_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tenures_city_active ON official_tenures (city, is_active);
CREATE INDEX IF NOT EXISTS idx_tenures_dates ON official_tenures (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tenures_position_active ON official_tenures (position, is_active);
CREATE INDEX IF NOT EXISTS idx_tenures_city_dates ON official_tenures (city, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tenures_geo ON official_tenures USING GIST (geo_boundaries);

-- ------------------------------------------------------------
-- reports  (was models/Report.js)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title                 TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
    description           TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
    category              TEXT NOT NULL CHECK (category IN
                             ('Road_Damage', 'Garbage_Collection', 'Street_Lighting', 'Water_Supply',
                              'Drainage', 'Illegal_Construction', 'Public_Property_Damage', 'Other')),

    -- GeoJSON Point -> PostGIS geography (longitude, latitude)
    location              GEOGRAPHY(Point, 4326) NOT NULL,

    address_street        TEXT,
    address_area          TEXT,
    address_ward          TEXT,
    address_city          TEXT NOT NULL,
    address_pincode       TEXT,

    media_type            TEXT NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'video')),
    media_url             TEXT,
    cloudinary_id         TEXT,
    gridfs_id             TEXT,   -- video files stay in MongoDB GridFS; this is the Mongo ObjectId string

    status                TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN
                             ('Pending', 'Acknowledged', 'In_Progress', 'Reported', 'Solved', 'Rejected')),
    priority               TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),

    reported_by            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to             UUID REFERENCES users(id),
    official_tenure_id      UUID REFERENCES official_tenures(id),

    -- resolutionDetails sub-doc
    resolution_description        TEXT,
    resolution_resolved_by        UUID REFERENCES users(id),
    resolution_resolved_at        TIMESTAMPTZ,
    resolution_verification_media JSONB NOT NULL DEFAULT '[]',   -- [{url, cloudinaryId}]
    resolution_verification_status TEXT NOT NULL DEFAULT 'pending_verification' CHECK
                                    (resolution_verification_status IN
                                     ('pending_verification', 'verified', 'rejected', 'auto_verified')),
    resolution_verification_deadline TIMESTAMPTZ,
    resolution_verified_by        UUID REFERENCES users(id),
    resolution_verified_at        TIMESTAMPTZ,
    resolution_verification_comment TEXT,
    resolution_reminder_sent_at   TIMESTAMPTZ,

    -- AI enrichment (assigned by the report.worker.js background job)
    ai_reasoning           TEXT,
    ai_processed_at         TIMESTAMPTZ,

    upvotes                INTEGER NOT NULL DEFAULT 0,
    views                  INTEGER NOT NULL DEFAULT 0,

    is_public               BOOLEAN NOT NULL DEFAULT true,
    is_archived              BOOLEAN NOT NULL DEFAULT false,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reportedby_created ON reports (reported_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_assignedto_status ON reports (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_reports_city_status ON reports (address_city, status);
CREATE INDEX IF NOT EXISTS idx_reports_category_status ON reports (category, status);
CREATE INDEX IF NOT EXISTS idx_reports_tenure ON reports (official_tenure_id);

-- statusHistory[] sub-doc -> normalized child table
CREATE TABLE IF NOT EXISTS report_status_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id     UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    status        TEXT NOT NULL CHECK (status IN
                    ('Pending', 'Acknowledged', 'In_Progress', 'Reported', 'Solved', 'Rejected')),
    updated_by    UUID REFERENCES users(id),
    comment       TEXT,
    "timestamp"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_status_history_report ON report_status_history (report_id, "timestamp");

-- notifications[] sub-doc on Report (legacy, distinct from the in-app `notifications` table below)
CREATE TABLE IF NOT EXISTS report_notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id    UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    type         TEXT NOT NULL CHECK (type IN
                   ('status_update', 'resolution_request', 'verification_reminder')),
    sent_at      TIMESTAMPTZ,
    sent_to      UUID REFERENCES users(id),
    read         BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_report_notifications_report ON report_notifications (report_id);

-- upvotedBy[] sub-doc -> junction table (also enforces "one upvote per user" like the Mongoose .includes() check)
CREATE TABLE IF NOT EXISTS report_upvotes (
    report_id    UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (report_id, user_id)
);

-- ------------------------------------------------------------
-- notifications  (was models/Notification.js — in-app notifications)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT NOT NULL CHECK (type IN
                   ('report_created', 'report_assigned', 'status_updated', 'ai_analysis_completed',
                    'report_commented', 'report_resolved', 'report_rejected', 'system_announcement')),
    title        TEXT NOT NULL CHECK (char_length(title) <= 200),
    message      TEXT NOT NULL CHECK (char_length(message) <= 500),
    data         JSONB NOT NULL DEFAULT '{}',
    priority     TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    read         BOOLEAN NOT NULL DEFAULT false,
    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read_created
    ON notifications (recipient, read, created_at DESC);

-- Mongo's `expireAfterSeconds: 2592000` (30-day TTL) has no direct Postgres equivalent.
-- Run this periodically (e.g. via node-cron, alongside CronJobs.init(), or pg_cron if installed):
--   DELETE FROM notifications WHERE created_at < now() - interval '30 days';

-- ------------------------------------------------------------
-- refresh_tokens
-- Access tokens are short-lived, stateless JWTs — never stored here.
-- Refresh tokens are opaque random strings; only their SHA-256 hash
-- is stored, so a DB leak alone can't be replayed as a live session.
-- Revoking a refresh token (logout, rotation, "log out all devices")
-- is a plain UPDATE here — this is what makes revocation possible at
-- all, since the JWT access token itself can't be un-signed early.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash        TEXT NOT NULL UNIQUE,
    expires_at        TIMESTAMPTZ NOT NULL,
    revoked_at        TIMESTAMPTZ,
    replaced_by_hash  TEXT,             -- set on rotation, points to the token that replaced this one
    user_agent        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens (user_id, revoked_at);

-- ------------------------------------------------------------
-- updated_at auto-touch trigger (Mongoose's `timestamps: true` did this for free)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON reports;
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tenures_updated_at ON official_tenures;
CREATE TRIGGER trg_tenures_updated_at BEFORE UPDATE ON official_tenures
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
