// ============================================
// server.js (UPDATED - Fixed GridFS Init)
// ============================================
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const CronJobs = require('./utils/cronJobs');
const healthRoutes = require('./routes/healthRoutes');
const sseService = require('./services/sseService');
const aiAnalysisWorker = require('./workers/report.worker');
const notificationWorker = require('./workers/notification.worker');
// require('./utils/keepAlive');
// console.log('🚀 BullMQ workers initialized');
const app = express();

// Security Middleware
app.use(helmet());

// Allow a comma-separated list of origins via ALLOWED_ORIGINS, falling back
// to the single CLIENT_URL for simple single-frontend deployments.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser requests (no Origin header, e.g. curl/Postman/server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));


// Rate Limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const server = http.createServer(app);

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
app.use('/api/v1/notifications', require('./routes/notificationRoutes'));



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
//
// Guarded so `require('./server')` from a test file just gets `app`
// back (for supertest) without opening a real port, connecting to
// Mongo, or registering signal handlers.
if (require.main === module) {
    CronJobs.init();

    connectDB().then(() => {
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 CivicTrack API running on port ${PORT}`);
            console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    }).catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, closing workers...');
        sseService.closeAll();
        await Promise.all([
            aiAnalysisWorker.close(),
            notificationWorker.close(),
        ]);
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('SIGINT received, closing workers...');
        sseService.closeAll();
        await Promise.all([
            aiAnalysisWorker.close(),
            notificationWorker.close(),
        ]);
        process.exit(0);
    });
}

module.exports = { app, server };