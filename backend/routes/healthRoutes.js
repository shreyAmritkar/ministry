const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { pool } = require('../db/pool');

router.get('/', async (req, res) => {
    try {
        // Check PostgreSQL (primary datastore)
        let postgresStatus = 'disconnected';
        try {
            await pool.query('SELECT 1');
            postgresStatus = 'connected';
        } catch (e) {
            postgresStatus = 'disconnected';
        }

        // Check MongoDB (GridFS video storage only)
        const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

        res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            postgres: postgresStatus,
            mongodb_gridfs: mongoStatus,
            environment: process.env.NODE_ENV,
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            error: error.message,
        });
    }
});

module.exports = router;