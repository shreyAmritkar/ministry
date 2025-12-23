// ============================================
// lib/socket.ts - Socket.IO Client Setup
// ============================================
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initializeSocket = (token: string): Socket => {
    // Disconnect existing socket if any
    if (socket?.connected) {
        console.log('Socket already connected, reusing connection');
        return socket;
    }

    if (socket) {
        socket.disconnect();
    }

    const backendUrl =  process.env.BACKEND_SOCKET || 'http://localhost:5000';
    console.log('🔌 Initializing Socket.IO connection to:', backendUrl);
    console.log('🔑 Using token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

    socket = io(backendUrl, {
        // Auth options
        auth: { token },

        // Transport options
        transports: ['websocket', 'polling'],
        upgrade: true,

        // Reconnection options
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,

        // Timeout options
        timeout: 20000,

        // Other options
        autoConnect: true,
        forceNew: false,
    });

    socket.on('connect', () => {
        console.log('✅ Socket connected successfully!');
        console.log('   Socket ID:', socket?.id);
        console.log('   Transport:', socket?.io.engine.transport.name);
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        if (reason === 'io server disconnect') {
            // Server disconnected, try to reconnect
            socket?.connect();
        }
    });

    socket.on('connect_error', (error) => {
        // console.error('❌ Socket connection error:', error.message);
        // console.error('   This usually means:');
        // console.error('   1. Backend server is not running');
        // console.error('   2. CORS is not properly configured');
        // console.error('   3. Wrong backend URL in NEXT_PUBLIC_API_URL');
        // console.error('   Current URL:', backendUrl);
        console.log(error);
    });

    socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
    });

    socket.io.on('reconnect_attempt', (attempt) => {
        console.log(`🔄 Reconnection attempt ${attempt}`);
    });

    socket.io.on('reconnect', (attempt) => {
        console.log(`✅ Reconnected after ${attempt} attempts`);
    });

    socket.io.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed after all attempts');
    });

    return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
    if (socket) {
        console.log('🔌 Disconnecting socket');
        socket.disconnect();
        socket = null;
    }
};