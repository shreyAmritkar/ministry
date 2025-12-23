// ============================================
// hooks/useSocket.ts - Socket Hook
// ============================================
'use client';

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { initializeSocket, disconnectSocket } from '@/lib/socket';
import { useAuth } from './useAuth';

export const useSocket = () => {
    const { user, token } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (user && token) {
            const socketInstance = initializeSocket(token);
            setSocket(socketInstance);

            socketInstance.on('connect', () => setConnected(true));
            socketInstance.on('disconnect', () => setConnected(false));

            return () => {
                disconnectSocket();
                setConnected(false);
            };
        }
    }, [user, token]);

    return { socket, connected };
};
