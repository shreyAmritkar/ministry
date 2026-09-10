// ============================================
// hooks/useReportStream.ts
// Live updates (status changes, upvotes) for one report's detail page.
// ============================================
'use client';

import { useEffect } from 'react';
import { openStream } from '@/lib/sse';

type ReportUpdate = { status?: string; upvotes?: number; updatedAt?: string };

/**
 * Subscribes to live updates for a single report. `onUpdate` fires
 * whenever the report changes on the server (status update, upvote)
 * while this component is mounted — typically used to just refetch
 * the report rather than trying to merge the partial payload.
 *
 * This stream is unauthenticated (matches GET /reports/:id, which is
 * also public) — no token is attached.
 */
export function useReportStream(reportId: string | undefined, onUpdate: (data: ReportUpdate) => void) {
    useEffect(() => {
        if (!reportId) return;

        const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
        const source = new EventSource(`${baseURL}/reports/${reportId}/stream`);

        source.addEventListener('report-updated', (e: MessageEvent) => {
            try {
                onUpdate(e.data ? JSON.parse(e.data) : {});
            } catch (err) {
                console.error('Failed to parse report-updated payload:', err);
            }
        });

        source.onerror = () => {
            // EventSource retries on its own; nothing else to do here.
        };

        return () => source.close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportId]);
}
