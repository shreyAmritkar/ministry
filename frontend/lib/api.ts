// lib/api.ts
import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ============================================
// Token storage
// - accessToken: short-lived, sent as `Authorization: Bearer`.
// - refreshToken: long-lived, only ever sent to /auth/refresh-token
//   and /auth/logout. Never attached to normal API calls.
// Kept in memory (fast, survives no reload-flicker) AND localStorage
// (survives a page reload / new tab).
// ============================================
let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

// Lets React state (useAuth's `token`) stay in sync
// even when the token changes from inside this file (e.g. after a
// silent refresh triggered by the interceptor below, which happens
// outside any React event handler).
type TokenListener = (accessToken: string | null) => void;
const listeners = new Set<TokenListener>();

export function onAccessTokenChange(cb: TokenListener): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

function notifyListeners(accessToken: string | null) {
    listeners.forEach((cb) => cb(accessToken));
}

export function getAccessToken(): string | null {
    if (inMemoryAccessToken) return inMemoryAccessToken;
    if (typeof window !== 'undefined') return localStorage.getItem('accessToken');
    return null;
}

export function getRefreshToken(): string | null {
    if (inMemoryRefreshToken) return inMemoryRefreshToken;
    if (typeof window !== 'undefined') return localStorage.getItem('refreshToken');
    return null;
}

/** Sets (or clears, when passed null) both tokens. */
export function setAuthTokens(accessToken: string | null, refreshToken: string | null) {
    inMemoryAccessToken = accessToken;
    inMemoryRefreshToken = refreshToken;

    if (typeof window !== 'undefined') {
        if (accessToken) localStorage.setItem('accessToken', accessToken);
        else localStorage.removeItem('accessToken');

        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        else localStorage.removeItem('refreshToken');
    }

    notifyListeners(accessToken);
}

// Request interceptor: attach the access token
api.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ============================================
// Response interceptor: on a 401, try exactly one silent refresh,
// then retry the original request. If several requests 401 at once
// (e.g. a dashboard firing 4 parallel calls right as the access token
// expires), only the FIRST one triggers an actual refresh call — the
// rest queue up and reuse its result, so the refresh token doesn't
// get used (and rotated) multiple times concurrently.
// ============================================
let isRefreshing = false;
let pendingRequests: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}> = [];

function flushQueue(error: unknown, newAccessToken: string | null) {
    pendingRequests.forEach(({ resolve, reject }) => {
        if (newAccessToken) resolve(newAccessToken);
        else reject(error);
    });
    pendingRequests = [];
}

function forceLogout() {
    setAuthTokens(null, null);
    if (typeof window !== 'undefined' && window.location.pathname !== '/auth/login') {
        window.location.href = '/auth/login';
    }
}

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh-token', '/auth/logout'];

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const originalRequest = error.config;

        const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => originalRequest?.url?.includes(path));

        if (error.response?.status !== 401 || isAuthEndpoint || originalRequest._retry) {
            return Promise.reject(error);
        }

        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            forceLogout();
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        if (isRefreshing) {
            // Another request already kicked off a refresh — wait for it
            // instead of firing a second, redundant refresh call.
            return new Promise((resolve, reject) => {
                pendingRequests.push({ resolve, reject });
            }).then((newAccessToken) => {
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            });
        }

        isRefreshing = true;
        try {
            // Plain axios, not `api` — avoids re-triggering this same
            // interceptor if the refresh call itself ever 401s.
            const { data } = await axios.post(`${baseURL}/auth/refresh-token`, { refreshToken });
            const newAccessToken: string = data?.data?.accessToken;
            const newRefreshToken: string = data?.data?.refreshToken;

            setAuthTokens(newAccessToken, newRefreshToken);
            flushQueue(null, newAccessToken);

            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
        } catch (refreshError) {
            flushQueue(refreshError, null);
            forceLogout();
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
