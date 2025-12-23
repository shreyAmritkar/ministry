// ============================================
// hooks/useNotifications.ts
// ============================================
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from './useSocket';
import api from '@/lib/api';

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

export const useNotifications = () => {
    const { socket, connected } = useSocket();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch initial notifications
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

    // Fetch unread count
    const fetchUnreadCount = useCallback(async () => {
        try {
            const response = await api.get('/notifications/unread-count');
            setUnreadCount(response.data.data.count);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    }, []);

    // Mark notification as read
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

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        try {
            await api.patch('/notifications/mark-all-read');
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }, []);

    // Delete notification
    const deleteNotification = useCallback(async (notificationId: string) => {
        try {
            await api.delete(`/notifications/${notificationId}`);
            setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }, []);

    // Listen for real-time notifications
    useEffect(() => {
        if (!socket || !connected) return;

        const handleNewNotification = (notification: Notification) => {
            console.log('📬 New notification received:', notification);
            setNotifications((prev) => [notification, ...prev]);
            setUnreadCount((prev) => prev + 1);

            // Show browser notification if permitted
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notification.title, {
                    body: notification.message,
                    icon: '/notification.png',
                });
            }
        };

        const handleNotificationRead = ({ notificationId }: { notificationId: string }) => {
            setNotifications((prev) =>
                prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
            );
        };

        const handleNotificationsCleared = () => {
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        };

        socket.on('notification', handleNewNotification);
        socket.on('notification-read', handleNotificationRead);
        socket.on('notifications-cleared', handleNotificationsCleared);

        return () => {
            socket.off('notification', handleNewNotification);
            socket.off('notification-read', handleNotificationRead);
            socket.off('notifications-cleared', handleNotificationsCleared);
        };
    }, [socket, connected]);

    // Initial data fetch
    useEffect(() => {
        if (connected) {
            fetchNotifications();
            fetchUnreadCount();
        }
    }, [connected, fetchNotifications, fetchUnreadCount]);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refetch: fetchNotifications,
    };
};