// ============================================
// components/notifications/NotificationProvider.tsx
// ============================================
'use client';

import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import {useNotifications} from "@/hooks/useNotifications";

export default function NotificationProvider({
                                                 children,
                                             }: {
    children: React.ReactNode;
}) {
    const { socket, connected } = useSocket();
    const { user } = useAuth();
    useNotifications();
    // Request browser notification permission
    useEffect(() => {
        if (user && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, [user]);

    // Log connection status
    useEffect(() => {
        if (connected) {
            console.log('✅ Real-time notifications enabled');
        }
    }, [connected]);

    return <>{children}</>;
}
