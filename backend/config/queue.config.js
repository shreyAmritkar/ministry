// ============================================
// config/queue.config.js
// ============================================
const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');


// Redis connection configuration
let redisConnection;

try {
    // Redis connection configuration
    redisConnection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        reconnectOnError: (err) => {
            console.error('Redis connection error:', err.message);
            return true;
        }
    });

    redisConnection.on('connect', () => {
        console.log('✅ Redis connected successfully');
    });

    redisConnection.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        console.log('💡 Tip: Make sure Redis is running on', process.env.REDIS_HOST || 'localhost');
    });
} catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    console.log('⚠️  Queue features will be disabled');
}


// Default job options
const defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000,
    },
    removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000,
    },
    removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
};

module.exports = {
    redisConnection,
    defaultJobOptions,
};