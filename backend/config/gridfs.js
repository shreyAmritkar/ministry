
// ============================================
// config/gridfs.js (UPDATED - Better Error Handling)
// ============================================
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let gridfsBucket;

const initGridFS = () => {
    try {
        const conn = mongoose.connection;

        if (!conn || !conn.db) {
            console.error('❌ MongoDB connection not ready for GridFS');
            return;
        }

        gridfsBucket = new GridFSBucket(conn.db, {
            bucketName: 'videos'
        });

        console.log('✅ GridFS initialized');
    } catch (error) {
        console.error('❌ GridFS initialization error:', error.message);
    }
};

const getGridFSBucket = () => {
    if (!gridfsBucket) {
        throw new Error('GridFS not initialized. Call initGridFS first after MongoDB connects.');
    }
    return gridfsBucket;
};

module.exports = { initGridFS, getGridFSBucket };
