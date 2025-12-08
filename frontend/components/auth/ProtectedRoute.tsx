// ============================================
// components/ProtectedRoute.tsx (UPDATED - With Role Check)
// ============================================
'use client';

import React, { useEffect } from 'react';
import { useAuthContext } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';

interface Props {
    children: React.ReactNode;
    redirectTo?: string;
    requiredRole?: 'admin' | 'official' | 'user';
    requireAuth?: boolean;
}

export default function ProtectedRoute({
                                           children,
                                           redirectTo = '/auth/login',
                                           requiredRole,
                                           requireAuth = true
                                       }: Props) {
    const { user, loading } = useAuthContext();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        // Not logged in
        if (requireAuth && !user) {
            router.replace(redirectTo);
            return;
        }

        // Role mismatch
        if (user && requiredRole && user.role !== requiredRole) {
            router.replace('/');
            return;
        }
    }, [loading, user, requiredRole]);



    // If auth required but no user, return null (redirect in effect)
    if (requireAuth && !user) {
        return null;
    }

    // If role required but user doesn't have it, show error
    if (requiredRole && user && user.role !== requiredRole) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <ShieldAlert className="w-16 h-16 text-red-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Access Denied
                    </h2>
                    <p className="text-gray-600 mb-6">
                        You don't have permission to access this page.
                        {requiredRole && ` This page requires '${requiredRole}' role.`}
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}