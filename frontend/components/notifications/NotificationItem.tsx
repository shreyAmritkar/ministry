// ============================================
// components/notifications/NotificationItem.tsx
// ============================================
'use client';

import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
    AlertCircle,
    CheckCircle,
    FileText,
    UserCheck,
    TrendingUp,
    X
} from 'lucide-react';

interface Props {
    notification: Notification;
    onClose: () => void;
}

const notificationIcons: Record<string, any> = {
    report_created: FileText,
    report_assigned: UserCheck,
    status_updated: TrendingUp,
    ai_analysis_completed: CheckCircle,
    system_announcement: AlertCircle,
};

const notificationColors: Record<string, string> = {
    low: 'text-gray-500',
    normal: 'text-blue-500',
    high: 'text-red-500',
};

export default function NotificationItem({ notification, onClose }: Props) {
    const { markAsRead, deleteNotification } = useNotifications();
    const router = useRouter();

    const Icon = notificationIcons[notification.type] || AlertCircle;
    const colorClass = notificationColors[notification.priority];

    const handleClick = () => {
        if (!notification.read) {
            markAsRead(notification._id);
        }

        // Navigate based on notification type
        if (notification.data?.reportId) {
            router.push(`/reports/${notification.data.reportId}`);
            onClose();
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteNotification(notification._id);
    };

    return (
        <div
            onClick={handleClick}
            className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
        >
            <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 mt-1 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {notification.title}
                        </p>
                        <button
                            onClick={handleDelete}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {notification.message}
                    </p>

                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                </div>

                {!notification.read && (
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2" />
                )}
            </div>
        </div>
    );
}