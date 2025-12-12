// **frontend/hooks/useSocket.ts**
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000'; // Match your backend URL

// Define the shape of the data being received
export interface ReportStatusUpdate {
    id: string;
    status: 'Reported' | 'In Progress' | 'Solved';
    coordinates: [number, number];
    title: string;
}

export const useSocket = () => {
    // Use useRef to store the socket instance across renders
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Prevent multiple connections
        if (!socketRef.current) {
            socketRef.current = io(SOCKET_URL, {
                reconnectionAttempts: 5,
            });

            const socket = socketRef.current;

            socket.on('connect', () => {
                setIsConnected(true);
                console.log('Socket Connected:', socket.id);
            });

            socket.on('disconnect', () => {
                setIsConnected(false);
                console.log('Socket Disconnected');
            });

            // Cleanup on unmount
            return () => {
                socket.off('connect');
                socket.off('disconnect');
                socket.close();
            };
        }
    }, []);

    // Function to allow components to subscribe to a specific event
    const subscribeToReportUpdates = useCallback((callback: (data: ReportStatusUpdate) => void) => {
        if (socketRef.current) {
            socketRef.current.on('reportStatusUpdate', callback);
        }
        // Return an unsubscribe function
        return () => {
            if (socketRef.current) {
                socketRef.current.off('reportStatusUpdate', callback);
            }
        };
    }, []);

    return { isConnected, subscribeToReportUpdates };
};