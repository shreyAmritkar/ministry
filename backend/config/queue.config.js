// ============================================
// config/queue.config.js
// ============================================
const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');


// Redis connection configuration
let redisConnection = null;

try {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.warn('⚠️  REDIS_URL not set. Queue features will be disabled.');
    } else {
        // Parse Redis URL
        const redisOptions = {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: (times) => {
                if (times > 10) {
                    console.error('❌ Redis: Max retry attempts reached');
                    return null;
                }
                return Math.min(times * 50, 2000);
            },
            reconnectOnError: (err) => {
                console.error('Redis reconnection error:', err.message);
                return true;
            }
        };

        // Add TLS only if the connection string requests it (e.g. Upstash uses rediss://).
        // Do NOT key this off NODE_ENV — a self-hosted Docker Redis in production
        // still speaks plain redis://, and forcing TLS onto it causes the client to
        // hang mid-handshake, which surfaces as a confusing ETIMEDOUT.
        if (redisUrl.startsWith('rediss://')) {
            redisOptions.tls = {
                rejectUnauthorized: false
            };
        }

        redisConnection = new Redis(redisUrl, redisOptions);

        redisConnection.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });

        redisConnection.on('ready', () => {
            console.log('✅ Redis ready to accept commands');
        });

        redisConnection.on('error', (err) => {
            console.error('❌ Redis error:', err.message);
        });

        redisConnection.on('close', () => {
            console.warn('⚠️  Redis connection closed');
        });
    }
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