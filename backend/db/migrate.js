// ============================================
// db/migrate.js
// Applies db/schema.sql using the same pool config as the app
// (DATABASE_URL + DB_USER + DB_PASSWORD), so there's no dependency on
// having the `psql` CLI installed or reassembling credentials into a
// single connection string.
//
// Usage: node db/migrate.js
// ============================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📦 Applying db/schema.sql ...');
    try {
        // node-postgres runs a plain string (no params) as a single
        // "simple query" — Postgres executes each ;-separated
        // statement in order, so the whole file can be sent at once.
        await pool.query(schemaSql);
        console.log('✅ Schema applied successfully.');
    } catch (error) {
        console.error('❌ Schema migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

migrate();
