// ============================================
// config/database.js (UPDATED - Added GridFS Init)
// ============================================
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            dbName: process.env.DB_NAME || 'civictrack'
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

        // Create indexes on connection
        await createIndexes();

        // Initialize GridFS after successful connection
        const { initGridFS } = require('./gridfs');
        initGridFS();

    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

const createIndexes = async () => {
    try {
        const Report = require('../models/Report');
        const OfficialTenure = require('../models/OfficialTenure');

        await Report.createIndexes();
        await OfficialTenure.createIndexes();
        console.log('✅ Database indexes created');
    } catch (error) {
        console.error('Index creation error:', error.message);
    }
};

module.exports = connectDB;
