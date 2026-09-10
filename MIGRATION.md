# MongoDB → PostgreSQL migration

This backend now runs on **PostgreSQL** (via raw `pg`, no ORM) for
users, reports, official tenures, and notifications. **MongoDB is kept
only for GridFS video storage** (files ≥10MB), per the migration
decision to leave file storage as-is.

## What changed

| Area | Before | After |
|---|---|---|
| Users / Reports / Tenures / Notifications | Mongoose models (`models/*.js`) | Raw-SQL data-access modules (`models/*.js`, same filenames, new contents) |
| IDs | Mongo ObjectId (24-hex string) | UUID (`gen_random_uuid()`) |
| Geospatial queries | `$near` / 2dsphere index | PostGIS `geography` column + `ST_DWithin` / `ST_Distance` |
| Aggregations | `.aggregate([...])` pipelines | Plain `GROUP BY` SQL in the model layer |
| Sub-documents (`statusHistory`, `upvotedBy`, notifications-on-report) | Embedded arrays | Normalized child tables (`report_status_history`, `report_upvotes`, `report_notifications`) |
| Flexible sub-objects (`address`, `officialDetails`, `resolutionDetails`, `contactInfo`, `metrics`) | Embedded objects | Flattened columns (simple, indexable, and this DB has no polymorphic shape needs) |
| Video files | GridFS | **Unchanged** — still GridFS, still MongoDB |
| `express-mongo-sanitize` | Sanitized Mongo operator injection | Removed — parameterized `pg` queries aren't vulnerable to this class of attack |

The JSON shape returned by the API is intentionally unchanged
(`_id`, camelCase keys, nested `address`/`officialDetails`/etc.
objects) so the **frontend needed no changes**.

## One pre-existing bug fixed in passing

`OfficialTenure` tenure-stats aggregation grouped by a `$zone` field
that no longer exists (a leftover from the ward → city rename). It's
now grouped by `city`, which is the real jurisdiction field, and the
response key is `byCity` instead of `byZone`.

## Setup

1. **Provision Postgres with PostGIS.** Locally via Docker: the
   updated `docker-compose.yml` adds a `postgres` service using the
   `postgis/postgis:16-3.4` image, and auto-applies `backend/db/schema.sql`
   on first boot. Managed options: Supabase, Neon, RDS (with the
   PostGIS extension enabled), etc.

2. **Set environment variables** (see `.env.example`):
   ```
   DATABASE_URL=jdbc:postgresql://host:port/database   # no credentials in this one
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_SSL=true    # set to false for a local/non-TLS Postgres
   MONGODB_URI=<unchanged — still needed for GridFS video storage>
   ```
   `db/pool.js` parses `DATABASE_URL` for host/port/database only and
   combines it with `DB_USER`/`DB_PASSWORD` to build the connection —
   this matches Supabase's pooler-style JDBC URL format, which doesn't
   embed credentials in the URL itself.

3. **Apply the schema** (skip if using the Docker Compose init script):
   ```
   npm run migrate     # runs: node db/migrate.js (applies db/schema.sql via the pg pool)
   ```

4. **Seed an admin user**:
   ```
   npm run seed:admin
   ```

5. **Install dependencies** (`pg` replaces the Mongoose ODM layer;
   `mongoose`/`mongodb` are kept for GridFS):
   ```
   npm install
   ```

6. Run as usual: `npm run dev` / `npm start`.

## Data migration from the existing MongoDB

This delivery covers the **schema and application-layer switch**. If
you have existing production data in MongoDB, you still need a
one-time ETL pass (Mongo → Postgres) before cutover:

1. Export each Mongo collection (`mongoexport` or a small script).
2. For each document, map fields per the tables in `db/schema.sql`
   (most fields are 1:1; sub-documents like `statusHistory` become
   rows in `report_status_history`, etc.).
3. Insert into Postgres, letting `gen_random_uuid()` mint new UUIDs
   — but **keep a lookup table of old ObjectId → new UUID** so you can
   correctly re-point foreign keys (`reportedBy`, `assignedTo`,
   `official_tenure_id`, etc.) as you migrate collections in this
   order: `users` → `official_tenures` → `reports` (+ its child
   tables) → `notifications`.
4. Leave GridFS files (`fs.files` / `fs.chunks`) untouched in MongoDB
   — only the `gridfs_id` string reference moves into the new
   `reports.gridfs_id` column.

I did not write this ETL script since I don't have access to your
production data or its exact volume/shape — happy to build it once
you share a sample export.

## Notes / trade-offs

- **No ORM, by request** — the data-access layer in `models/*.js` is
  plain parameterized SQL wrapped in functions (not a Mongoose-style
  query builder), matching the "raw SQL with `pg`" choice.
- **Mongo's TTL index** (`notifications` auto-delete after 30 days)
  has no direct Postgres equivalent; it's replaced with a nightly
  cron job in `utils/cronJobs.js`.
- **Transactions**: report creation and status updates that touch
  more than one table (`reports` + `report_status_history`) use
  `db/pool.js`'s `withTransaction` helper so they stay atomic.
- **Auth tokens**: access tokens are short-lived, stateless JWTs —
  never written to the database. Refresh tokens are opaque random
  strings; only their SHA-256 hash is persisted, in `refresh_tokens`,
  which is what makes them revocable (logout, rotation on every
  refresh, and "log out everywhere" via `/auth/logout-all`). See
  `models/RefreshToken.js` and `controllers/authController.js`.
- **Testing**: see "Running the tests" below — a real Postgres-backed
  integration suite, not everything mocked out.

## Running the tests

There's a real integration test suite under `backend/test/` (Jest +
Supertest) covering the auth flow (access/refresh tokens, rotation,
revocation), report creation/PostGIS storage/nearby search/upvoting,
and the SSE streams — not just unit tests with everything mocked out.

1. **A real PostgreSQL + PostGIS test database is required** — these
   tests genuinely exercise `ST_MakePoint`, `ST_DWithin`, transactions,
   etc., which nothing short of a real Postgres can validate:
   ```bash
   createdb civictrack_test
   psql -d civictrack_test -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS postgis;"
   psql -d civictrack_test -f backend/db/schema.sql
   ```
2. Copy `.env.test` (already checked in with safe placeholder
   credentials) or edit it to match your local Postgres user/password.
3. ```bash
   cd backend
   npm install
   npm test
   ```

No Redis or MongoDB is required — the two BullMQ workers are mocked
(see `test/setup/mockGlobals.js`), and `connectDB()`/GridFS are never
invoked in tests (`server.js` guards its bootstrap behind
`require.main === module`, so `require('./server')` from a test just
gets the Express `app` back).

Two real bugs were found and fixed while building this suite (not
introduced by the Postgres migration, but exposed by actually testing
against live infra rather than assuming things work):
- **`queues/report.queue.js`**: `Queue#add()` on a queue built with no
  Redis connection doesn't reject — it hangs forever. Report creation
  would have hung indefinitely with Redis unset/unreachable, despite
  looking like it was wrapped in a safe try/catch. Fixed with an
  explicit `if (!redisConnection) return null;` guard before calling
  `.add()`.
- **`services/sseService.js`**: the heartbeat `setInterval` wasn't
  `.unref()`'d, so it could keep the process alive unnecessarily.

One known, not-yet-fixed bug the tests document rather than silently
work around: `middleware/authorize.js`'s `authorizeOfficialOrAdmin`
checks `req.user.userType !== 'admin'`, but `userType` is never
`'admin'` — admin-ness lives only in `role`. An admin (as created by
`seed/createAdmin.js`) is currently blocked from `mark-resolved` and
`update-status`. See the
`'an admin is currently blocked from status updates too — known bug'`
test in `test/reports.test.js`.
