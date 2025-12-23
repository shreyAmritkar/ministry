// lib/api.ts
import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// In-memory token to avoid server-side localStorage access problems
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
    inMemoryToken = token;
    if (typeof window !== 'undefined') {
        if (token) localStorage.setItem('token', token);
        else localStorage.removeItem('token');
    }
}

// Request interceptor: prefer inMemoryToken, otherwise read localStorage (only in browser)
api.interceptors.request.use(
    (config) => {
        try {
            const token =
                inMemoryToken ??
                (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (e) {
            // no-op
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: handle 401 globally
api.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error.response?.status === 401) {
            // clear token & force redirect (only client)
            setAuthToken(null);
            if (typeof window !== 'undefined') {
                window.location.href = '/auth/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
