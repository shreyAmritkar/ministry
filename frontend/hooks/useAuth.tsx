// hooks/useAuth.tsx (FIXED - Better error handling)
'use client';

import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
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

    // 1. DEFINE CORE FUNCTIONS FIRST (Wrapped in useCallback for stability)
    // =========================================================================

    // Refresh function: Used by both init and the storage sync effect
    const refreshUser = useCallback(async (): Promise<User | null> => {
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
    }, [setUser]); // Dependencies: only setUser (stable state setter)

    // Logout function: Must be defined before the sync effect for completeness
    const logout = useCallback(() => {
        setUser(null);
        setAuthToken(null);

        // Crucial for sync: Remove the token from localStorage to notify other tabs
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
        }

        // Only redirect if not already on login page
        if (pathname !== '/auth/login') {
            router.replace('/auth/login');
        }
    }, [pathname, router]);

    // 2. USE EFFECTS (Now they can safely use the functions above)
    // =========================================================================

    // A. Initial Auth Check (Your existing useEffect)
    useEffect(() => {
        const init = async () => {
            try {
                if (typeof window !== 'undefined') {
                    const token = localStorage.getItem('token');
                    if (token) {
                        setAuthToken(token);
                        await refreshUser();
                    }
                }
            } catch (e) {
                console.error('Auth initialization error:', e);
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
    }, [refreshUser]); // Now refreshUser is in the dependency array

    // B. Cross-Tab Synchronization Effect (The new one)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'token') {
                const newToken = event.newValue;

                if (newToken) {
                    setAuthToken(newToken);
                    refreshUser();
                } else {
                    // Use the defined logout function for consistent state clearing
                    logout();
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
        // The dependency array now correctly lists all outside functions/variables used inside the effect.
    }, [refreshUser, logout]);


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