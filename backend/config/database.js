// ============================================
// config/database.js
// PostgreSQL is now the primary database (users, reports, tenures,
// notifications). A slim MongoDB connection is kept ONLY for GridFS
// video storage, per the migration decision to leave file storage as-is.
// ============================================
const { connectDB: connectPostgres } = require('../db/pool');
const mongoose = require('mongoose');

const connectDB = async () => {
    // 1. PostgreSQL — primary datastore
    await connectPostgres();

    // 2. MongoDB — GridFS only (large video files)
    if (process.env.MONGODB_URI) {
        try {
            const conn = await mongoose.connect(process.env.MONGODB_URI, {
                dbName: process.env.DB_NAME || 'civictrack',
            });
            console.log(`✅ MongoDB (GridFS) connected: ${conn.connection.host}`);

            const { initGridFS } = require('./gridfs');
            initGridFS();
        } catch (error) {
            // Non-fatal: large-video upload/streaming just won't work until this is fixed.
            console.error(`⚠️  MongoDB (GridFS) connection error: ${error.message}`);
        }
    } else {
        console.warn('⚠️  MONGODB_URI not set — GridFS video storage is disabled.');
    }
};

module.exports = connectDB;
