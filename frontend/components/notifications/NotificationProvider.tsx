// ============================================
// components/notifications/NotificationProvider.tsx
// This is the "opens the connection" box — mounts NotificationsProvider
// (one shared SSE connection) once, near the root of the app. Every
// consumer below it (Bell, Dropdown, Item) reads the same state via
// the useNotifications() context hook instead of opening their own.
// ============================================
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NotificationsProvider, useNotifications } from '@/hooks/useNotifications';

function NotificationEffects({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { connected } = useNotifications();

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

export default function NotificationProvider({
                                                 children,
                                             }: {
    children: React.ReactNode;
}) {
    return (
        <NotificationsProvider>
            <NotificationEffects>{children}</NotificationEffects>
        </NotificationsProvider>
    );
}
