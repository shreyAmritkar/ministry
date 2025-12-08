// hooks/useAuth.tsx (FIXED - Better error handling)
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import api, { setAuthToken } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

type User = {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
    userType?: string;
};

type AuthContextType = {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<User>;
    register: (payload: {
        name: string;
        email: string;
        phone?: string;
        password: string;
        userType?: string;
    }) => Promise<User>;
    logout: () => void;
    refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
    return ctx;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    // Initialize auth on mount
    useEffect(() => {
        const init = async () => {
            try {
                // If token exists in localStorage, set inMemory token first
                if (typeof window !== 'undefined') {
                    const token = localStorage.getItem('token');
                    if (token) {
                        setAuthToken(token);
                        await refreshUser();
                    }
                }
            } catch (e) {
                console.error('Auth initialization error:', e);
                // Clear invalid token
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                }
                setAuthToken(null);
            } finally {
                setLoading(false);
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshUser = async (): Promise<User | null> => {
        try {
            const res = await api.get('/auth/me');
            const userData = res.data.data ?? res.data;
            setUser(userData);
            return userData;
        } catch (err) {
            console.error('Failed to refresh user:', err);
            setUser(null);
            setAuthToken(null);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
            }
            return null;
        }
    };

    const login = async (email: string, password: string) => {
        const res = await api.post('/auth/login', { email, password });
        const token = res.data?.data?.token ?? res.data?.token ?? null;
        const userData = res.data?.data?.user ?? res.data?.user ?? null;

        if (!token) throw new Error('No token returned from login');

        setAuthToken(token);
        setUser(userData);
        return userData;
    };

    const register = async (payload: {
        name: string;
        email: string;
        phone?: string;
        password: string;
        userType?: string;
    }) => {
        const res = await api.post('/auth/register', payload);
        const token = res.data?.data?.token ?? res.data?.token ?? null;
        const userData = res.data?.data?.user ?? res.data?.user ?? null;

        if (!token) throw new Error('No token returned from register');

        setAuthToken(token);
        setUser(userData);
        return userData;
    };

    const logout = () => {
        setUser(null);
        setAuthToken(null);

        // Only redirect if not already on login page
        if (pathname !== '/auth/login') {
            router.replace('/auth/login');
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};