const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/', async (req, res) => {
    try {
        // Check MongoDB connection
        const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

        res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            mongodb: mongoStatus,
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