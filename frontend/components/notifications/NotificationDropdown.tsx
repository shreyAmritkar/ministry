// ============================================
// components/notifications/NotificationDropdown.tsx
// ============================================
'use client';

import { useNotifications } from '@/hooks/useNotifications';
import NotificationItem from './NotificationItem';
import { CheckCheck, Loader2, Bell } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export default function NotificationDropdown({ onClose }: Props) {
    const { notifications, loading, markAllAsRead, unreadCount } = useNotifications();

    return (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Notifications
                    {unreadCount > 0 && (
                        <span className="ml-2 text-sm text-gray-500">({unreadCount} new)</span>
                    )}
                </h3>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                        <CheckCheck className="w-4 h-4" />
                        Mark all read
                    </button>
                )}
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No notifications yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {notifications.map((notification) => (
                            <NotificationItem
                                key={notification._id}
                                notification={notification}
                                onClose={onClose}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
