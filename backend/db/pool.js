// ============================================
// db/pool.js
// Single shared node-postgres connection pool.
// Replaces mongoose's connection object.
//
// Connection is built from three separate env vars instead of one
// connection string with embedded credentials:
//   DATABASE_URL = jdbc:postgresql://host:port/database   (no credentials)
//   DB_USER      = postgres user
//   DB_PASSWORD  = postgres password
// (This matches Supabase's pooler-style JDBC URL format.)
// ============================================
const { Pool } = require('pg');

/**
 * Parses `jdbc:postgresql://host:port/database` (or a plain
 * `postgresql://host:port/database`, with or without the `jdbc:`
 * prefix) into { host, port, database }.
 */
function parseJdbcUrl(jdbcUrl) {
    const withoutJdbcPrefix = jdbcUrl.replace(/^jdbc:/, '');
    const url = new URL(withoutJdbcPrefix);
    return {
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 5432,
        database: url.pathname.replace(/^\//, '') || 'postgres',
    };
}

function buildPoolConfig() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set (expected format: jdbc:postgresql://host:port/database)');
    }

    const { host, port, database } = parseJdbcUrl(process.env.DATABASE_URL);

    // Supabase's pooler (and most managed Postgres) requires TLS.
    // Set DB_SSL=false to disable for a fully local, non-TLS instance.
    const sslEnabled = process.env.DB_SSL !== 'false';

    return {
        host,
        port,
        database,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: sslEnabled ? { rejectUnauthorized: false } : false,
        max: parseInt(process.env.PG_POOL_MAX, 10) || 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    };
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
    // Errors on idle clients shouldn't crash the process
    console.error('❌ Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Run a single parameterized query.
 * @param {string} text - SQL with $1, $2... placeholders
 * @param {Array} params
 */
const query = (text, params) => pool.query(text, params);

/**
 * Run a series of queries inside a transaction. `fn` receives a client
 * with the same `.query(text, params)` signature.
 *
 * Usage:
 *   await withTransaction(async (client) => {
 *       await client.query('UPDATE ...');
 *       await client.query('INSERT ...');
 *   });
 */
const withTransaction = async (fn) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const connectDB = async () => {
    try {
        const client = await pool.connect();
        const { rows } = await client.query('SELECT NOW()');
        client.release();
        console.log(`✅ PostgreSQL connected: ${rows[0].now}`);
    } catch (error) {
        console.error(`❌ PostgreSQL connection error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = { pool, query, withTransaction, connectDB };
