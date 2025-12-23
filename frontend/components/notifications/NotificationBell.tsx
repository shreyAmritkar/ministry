// ============================================
// components/notifications/NotificationBell.tsx
// ============================================
'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import { useNotifications } from '@/hooks/useNotifications';

// Accept unreadCount as prop instead of calling hook here
export default function NotificationBell() {
    const { unreadCount } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
                )}
            </button>

            {isOpen && <NotificationDropdown onClose={() => setIsOpen(false)} />}
        </div>
    );
}