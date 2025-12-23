// ============================================
// config/queue.config.js
// ============================================
const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');


// Redis connection configuration
const redisConnection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});


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