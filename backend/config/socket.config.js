const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

const initializeSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true,
            allowedHeaders: ['Authorization']
        },
        // Important: Allow all transports
        transports: ['websocket', 'polling'],
        // Increase timeouts for development
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6,
        // Allow upgrades
        allowUpgrades: true,
        // Cookie settings
        cookie: false,
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            // Try multiple auth methods
            let token = socket.handshake.auth.token;

            if (!token) {
                // Try from query params (fallback)
                token = socket.handshake.query.token;
            }

            if (!token) {
                // Try from headers
                const authHeader = socket.handshake.headers.authorization;
                if (authHeader) {
                    token = authHeader.replace('Bearer ', '');
                }
            }

            if (!token) {
                console.log('❌ No token provided in Socket.IO connection');
                return next(new Error('Authentication token missing'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                console.log('❌ User not found for token');
                return next(new Error('User not found'));
            }

            socket.user = user;
            console.log(`✅ Socket authenticated for user: ${user.email}`);
            next();
        } catch (error) {
            console.error('❌ Socket authentication error:', error.message);
            next(new Error('Authentication failed'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`✅ User connected: ${socket.user.name} (${socket.user._id})`);
        console.log(`   Transport: ${socket.conn.transport.name}`);
        console.log(`   Total clients: ${io.engine.clientsCount}`);

        // Join user-specific room
        socket.join(`user:${socket.user._id}`);

        // Join role-specific room
        socket.join(`role:${socket.user.role}`);

        // If official, join official-specific room
        if (socket.user.role === 'official' && socket.user.officialDetails?.official_id) {
            socket.join(`official:${socket.user.officialDetails.official_id}`);
        }

        // Handle room joining
        socket.on('join-report', (reportId) => {
            socket.join(`report:${reportId}`);
            console.log(`   User ${socket.user._id} joined report room: ${reportId}`);
        });

        socket.on('leave-report', (reportId) => {
            socket.leave(`report:${reportId}`);
            console.log(`   User ${socket.user._id} left report room: ${reportId}`);
        });

        socket.on('disconnect', (reason) => {
            console.log(`❌ User disconnected: ${socket.user.name}`);
            console.log(`   Reason: ${reason}`);
            console.log(`   Remaining clients: ${io.engine.clientsCount}`);
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error(`Socket error for user ${socket.user._id}:`, error);
        });
    });

    // Global error handler
    io.engine.on('connection_error', (err) => {
        console.error('Socket.IO connection error:', err);
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

module.exports = { initializeSocket, getIO };