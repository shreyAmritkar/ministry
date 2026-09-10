// ============================================
// hooks/useNotifications.tsx
//
//   [ Your Server ]
//         │  (1 stream only)
//         ▼
//  [ NotificationsProvider ]  <- opens the connection, owns the state
//     /        |        \
// (context) (context) (context)
//    v          v          v
// [ Bell ]  [ Dropdown ] [ Item ]
//
// Everything below the provider reads the SAME state via context
// instead of each opening its own EventSource — that's the difference
// between 1 connection per tab and N.
// ============================================
'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { openStream, SSEConnection } from '@/lib/sse';
import { useAuthContext } from './useAuth';

export interface Notification {
    _id: string;
    type: string;
    title: string;
    message: string;
    data: any;
    priority: 'low' | 'normal' | 'high';
    read: boolean;
    createdAt: string;
}

type NotificationsContextType = {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    connected: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    refetch: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuthContext();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const streamRef = useRef<SSEConnection | null>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/notifications?limit=50');
            setNotifications(response.data.data.notifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const response = await api.get('/notifications/unread-count');
            setUnreadCount(response.data.data.count);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    }, []);

    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            await api.patch(`/notifications/${notificationId}/read`);
            setNotifications((prev) =>
                prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await api.patch('/notifications/mark-all-read');
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }, []);

    const deleteNotification = useCallback(async (notificationId: string) => {
        try {
            await api.delete(`/notifications/${notificationId}`);
            setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }, []);

    // The ONE SSE connection for the whole app — opened here only.
    useEffect(() => {
        if (!user) {
            streamRef.current?.close();
            streamRef.current = null;
            setConnected(false);
            return;
        }

        streamRef.current = openStream('/notifications/stream', {
            connected: () => setConnected(true),

            notification: (notification: Notification) => {
                console.log('📬 New notification received:', notification);
                setNotifications((prev) => [notification, ...prev]);
                setUnreadCount((prev) => prev + 1);

                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(notification.title, {
                        body: notification.message,
                        icon: '/notification.png',
                    });
                }
            },

            'notification-read': ({ notificationId }: { notificationId: string }) => {
                setNotifications((prev) =>
                    prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
                );
            },

            'notifications-cleared': () => {
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                setUnreadCount(0);
            },
        });

        return () => {
            streamRef.current?.close();
            streamRef.current = null;
            setConnected(false);
        };
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchNotifications();
            fetchUnreadCount();
        }
    }, [user, fetchNotifications, fetchUnreadCount]);

    const value: NotificationsContextType = {
        notifications,
        unreadCount,
        loading,
        connected,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refetch: fetchNotifications,
    };

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/** Consumer hook — Bell, Dropdown, Item, etc. all read the same shared state through this. */
export function useNotifications() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return ctx;
}
