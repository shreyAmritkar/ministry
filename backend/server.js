// ============================================
// server.js (UPDATED - Fixed GridFS Init)
// ============================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const CronJobs = require('./utils/cronJobs');
require('dotenv').config();
const healthRoutes = require('./routes/healthRoutes');
const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(mongoSanitize());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Initialize cron jobs
CronJobs.init();
// Health Check
// app.get('/health', (req, res) => {
//     res.status(200).json({
//         status: 'success',
//         message: 'CivicTrack API is running',
//         timestamp: new Date().toISOString()
//     });
// });

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/users', require('./routes/userRoutes'));
app.use('/api/v1/reports', require('./routes/reportRoutes'));
app.use('/api/v1/tenures', require('./routes/tenureRoutes'));
app.use('/api/v1/media', require('./routes/mediaRoutes'));
app.use('/api/v1/analytics', require('./routes/analyticsRoutes'));
app.use('/api/v1/officials', require('./routes/officialRoutes'));

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found`
    });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first, then start server
// GridFS will be initialized automatically in connectDB
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 CivicTrack API running on port ${PORT}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});