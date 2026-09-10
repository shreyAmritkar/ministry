// ============================================
// lib/sse.ts
// Small wrapper around the browser's EventSource for our SSE streams.
//
// Handles one thing EventSource doesn't do on its own: reconnecting
// with a FRESH access token. EventSource bakes the URL (and therefore
// the token query param) in at creation time and just keeps retrying
// that same URL forever on drop — so if the token has expired since
// the stream opened, it'll loop on 401s indefinitely. We listen for
// `onAccessTokenChange` (see lib/api.ts) and re-open the stream with
// whatever the current token is whenever it changes, plus retry with
// backoff on a plain connection error.
// ============================================
import { getAccessToken, onAccessTokenChange } from './api';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type StreamHandlers = Record<string, (data: any) => void>;

export type SSEConnection = {
    close: () => void;
};

/**
 * Opens an SSE connection to `${baseURL}${path}`, authenticated via a
 * `token` query param (EventSource can't set headers). Automatically
 * reconnects with a fresh token if the access token rotates, and
 * retries with backoff on transient drops.
 *
 * @param path     e.g. '/notifications/stream' or '/reports/abc123/stream'
 * @param handlers map of SSE event name -> callback, e.g. { notification: (n) => ... }
 */
export function openStream(path: string, handlers: StreamHandlers): SSEConnection {
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = 1000;
    let closed = false;

    const connect = () => {
        const token = getAccessToken();
        if (!token) return; // no session — nothing to stream

        const url = `${baseURL}${path}?token=${encodeURIComponent(token)}`;
        source = new EventSource(url);

        Object.entries(handlers).forEach(([event, handler]) => {
            source!.addEventListener(event, (e: MessageEvent) => {
                try {
                    handler(e.data ? JSON.parse(e.data) : undefined);
                } catch (err) {
                    console.error(`Failed to parse SSE "${event}" payload:`, err);
                }
            });
        });

        source.onopen = () => {
            retryDelayMs = 1000; // reset backoff after a successful connect
        };

        source.onerror = () => {
            source?.close();
            if (closed) return;
            // Exponential backoff, capped at 30s, then reconnect with
            // whatever the current (possibly since-refreshed) token is.
            reconnectTimer = setTimeout(connect, retryDelayMs);
            retryDelayMs = Math.min(retryDelayMs * 2, 30000);
        };
    };

    connect();

    // If lib/api.ts silently refreshes the access token (e.g. a normal
    // API call 401'd and got a new one), reconnect this stream right
    // away with the fresh token instead of waiting for it to error out.
    const unsubscribe = onAccessTokenChange((newToken) => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        source?.close();
        if (newToken) connect();
    });

    return {
        close: () => {
            closed = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            source?.close();
            unsubscribe();
        },
    };
}
