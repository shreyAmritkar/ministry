// ============================================
// Frontend: app/reports/[id]/verify/page.tsx
// ============================================
'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { Report } from '@/types/report';

export default function VerifyResolutionPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [comment, setComment] = useState('');
    const [report, setReport] = useState<Report | null>(null);

    const action = searchParams.get('action'); // 'verify' or 'reject'

    useEffect(() => {
        if (params.id) {
            fetchReport();
        }
    }, [params.id]);

    const fetchReport = async () => {
        try {
            const response = await api.get(`/reports/${params.id}`);
            setReport(response.data.data);
        } catch (error) {
            console.error('Failed to fetch report:', error);
        }
    };

    const handleVerification = async (verified: boolean) => {
        setLoading(true);
        try {
            await api.patch(`/reports/${params.id}/verify-resolution`, {
                verified,
                comment
            });

            router.push(`/reports/${params.id}?verified=${verified}`);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    if (!report) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    // Check if resolution details exist
    if (!report.resolutionDetails) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">No resolution to verify</p>
                    <button
                        onClick={() => router.push(`/reports/${params.id}`)}
                        className="text-blue-600 hover:underline"
                    >
                        ← Back to Report
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="container mx-auto px-4 max-w-2xl">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        Verify Resolution
                    </h1>

                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                        <h3 className="font-semibold mb-2">{report.title}</h3>
                        <p className="text-sm text-gray-600">
                            {report.resolutionDetails.description}
                        </p>
                    </div>

                    <p className="text-gray-700 mb-6">
                        Has this issue been actually resolved to your satisfaction?
                    </p>

                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Add any comments (optional)"
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleVerification(true)}
                            disabled={loading}
                            className="py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CheckCircle className="w-5 h-5" />
                            {loading ? 'Processing...' : 'Yes, Issue Resolved'}
                        </button>

                        <button
                            onClick={() => handleVerification(false)}
                            disabled={loading}
                            className="py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <XCircle className="w-5 h-5" />
                            {loading ? 'Processing...' : 'No, Still Not Fixed'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}