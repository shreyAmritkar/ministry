// ============================================
// hooks/useAuth.tsx
// ============================================
'use client';

import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import api, { setAuthTokens, getAccessToken, getRefreshToken, onAccessTokenChange } from '@/lib/api';
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
    token: string | null; // access token — exported for Socket.IO auth
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
    logoutAllDevices: () => Promise<void>;
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
    const [token, setToken] = useState<string | null>(null); // access token only
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

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
            setAuthTokens(null, null);
            return null;
        }
    }, []);

    // Best-effort server-side revocation of the refresh token, then
    // clear local state regardless of whether the network call succeeds
    // (the user should always be able to log out locally).
    const logout = useCallback(() => {
        const refreshToken = getRefreshToken();

        setUser(null);
        setToken(null);
        setAuthTokens(null, null);

        if (refreshToken) {
            api.post('/auth/logout', { refreshToken }).catch(() => {
                // Ignore — tokens are already cleared client-side either way.
            });
        }

        if (pathname !== '/auth/login') {
            router.replace('/auth/login');
        }
    }, [pathname, router]);

    const logoutAllDevices = useCallback(async () => {
        await api.post('/auth/logout-all');
        logout();
    }, [logout]);

    // Initial auth check — restore session from localStorage on load
    useEffect(() => {
        const init = async () => {
            try {
                const storedAccessToken = getAccessToken();
                if (storedAccessToken) {
                    setToken(storedAccessToken);
                    await refreshUser(); // if the access token has expired, api.ts's
                                          // interceptor transparently refreshes it
                                          // and retries this call before we see a 401
                }
            } catch (e) {
                console.error('Auth initialization error:', e);
                setAuthTokens(null, null);
                setToken(null);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [refreshUser]);

    // Keep React state in sync when the access token changes from
    // OUTSIDE React — i.e. the silent-refresh interceptor in lib/api.ts,
    // which runs in an axios error handler, not an event handler.
    useEffect(() => {
        return onAccessTokenChange((newAccessToken) => {
            setToken(newAccessToken);
            if (!newAccessToken) setUser(null);
        });
    }, []);

    // Cross-tab synchronization
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'accessToken') {
                const newToken = event.newValue;
                if (newToken) {
                    setToken(newToken);
                    refreshUser();
                } else {
                    // Another tab logged out — mirror it here without
                    // re-triggering a network call to /auth/logout.
                    setUser(null);
                    setToken(null);
                    if (pathname !== '/auth/login') {
                        router.replace('/auth/login');
                    }
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [refreshUser, pathname, router]);

    const login = async (email: string, password: string) => {
        const res = await api.post('/auth/login', { email, password });
        const newAccessToken = res.data?.data?.accessToken ?? null;
        const newRefreshToken = res.data?.data?.refreshToken ?? null;
        const userData = res.data?.data?.user ?? null;

        if (!newAccessToken || !newRefreshToken) {
            throw new Error('No tokens returned from login');
        }

        setToken(newAccessToken);
        setAuthTokens(newAccessToken, newRefreshToken);
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
        const newAccessToken = res.data?.data?.accessToken ?? null;
        const newRefreshToken = res.data?.data?.refreshToken ?? null;
        const userData = res.data?.data?.user ?? null;

        if (!newAccessToken || !newRefreshToken) {
            throw new Error('No tokens returned from register');
        }

        setToken(newAccessToken);
        setAuthTokens(newAccessToken, newRefreshToken);
        setUser(userData);
        return userData;
    };

    const value: AuthContextType = {
        user,
        token,
        loading,
        login,
        register,
        logout,
        logoutAllDevices,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Export the hook with the correct name
export const useAuth = useAuthContext;
