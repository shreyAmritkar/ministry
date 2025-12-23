// ============================================
// hooks/useAuth.tsx (UPDATED - Add token export)
// ============================================
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
    token: string | null; // NEW: Export token for Socket.IO
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
    const [token, setToken] = useState<string | null>(null); // NEW: Track token
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    // Refresh function
    const refreshUser = useCallback(async (): Promise<User | null> => {
        try {
            const res = await api.get('/auth/me');
            const userData = res.data.data ?? res.data;
            setUser(userData);
            return userData;
        } catch (err) {
            console.error('Failed to refresh user:', err);
            setUser(null);
            setToken(null);
            setAuthToken(null);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
            }
            return null;
        }
    }, []);

    // Logout function
    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        setAuthToken(null);

        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
        }

        if (pathname !== '/auth/login') {
            router.replace('/auth/login');
        }
    }, [pathname, router]);

    // Initial Auth Check
    useEffect(() => {
        const init = async () => {
            try {
                if (typeof window !== 'undefined') {
                    const storedToken = localStorage.getItem('token');
                    if (storedToken) {
                        setToken(storedToken);
                        setAuthToken(storedToken);
                        await refreshUser();
                    }
                }
            } catch (e) {
                console.error('Auth initialization error:', e);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                }
                setAuthToken(null);
                setToken(null);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [refreshUser]);

    // Cross-Tab Synchronization
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'token') {
                const newToken = event.newValue;

                if (newToken) {
                    setToken(newToken);
                    setAuthToken(newToken);
                    refreshUser();
                } else {
                    logout();
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [refreshUser, logout]);

    const login = async (email: string, password: string) => {
        const res = await api.post('/auth/login', { email, password });
        const newToken = res.data?.data?.token ?? res.data?.token ?? null;
        const userData = res.data?.data?.user ?? res.data?.user ?? null;

        if (!newToken) throw new Error('No token returned from login');

        setToken(newToken);
        setAuthToken(newToken);
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
        const newToken = res.data?.data?.token ?? res.data?.token ?? null;
        const userData = res.data?.data?.user ?? res.data?.user ?? null;

        if (!newToken) throw new Error('No token returned from register');

        setToken(newToken);
        setAuthToken(newToken);
        setUser(userData);
        return userData;
    };

    const value: AuthContextType = {
        user,
        token, // NEW: Export token
        loading,
        login,
        register,
        logout,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Export the hook with the correct name
export const useAuth = useAuthContext;