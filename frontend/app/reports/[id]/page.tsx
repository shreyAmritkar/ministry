// ============================================
// app/reports/[id]/page.tsx - Report Detail Page (NEW)
// ============================================
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Calendar, User, TrendingUp, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { Report } from '@/types/report';
import StatusBadge from '@/components/reports/StatusBadge';
import { useReportStream } from '@/hooks/useReportStream';

export default function ReportDetailPage() {
    const params = useParams();
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id) {
            fetchReport(params.id as string);
        }
    }, [params.id]);

    // Live status/upvote updates while this page is open — refetches
    // the full report rather than trying to merge the partial SSE payload.
    useReportStream(params.id as string | undefined, () => {
        if (params.id) fetchReport(params.id as string);
    });

    const fetchReport = async (id: string) => {
        try {
            setLoading(true);
            const response = await api.get(`/reports/${id}`);
            setReport(response.data.data);
        } catch (error) {
            console.error('Failed to fetch report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpvote = async () => {
        if (!report) return;
        try {
            await api.patch(`/reports/${report._id}/upvote`);
            setReport({ ...report, upvotes: report.upvotes + 1 });
        } catch (error) {
            console.error('Failed to upvote:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">Report not found</p>
                    <Link href="/reports" className="text-blue-600 hover:underline">
                        ← Back to Reports
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4 max-w-4xl">
                {/* Back Button */}
                <Link
                    href="/reports"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Reports
                </Link>

                <div className="bg-white rounded-xl shadow-lg p-8">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                {report.title}
                            </h1>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                  {report.category.replace(/_/g, ' ')}
                </span>
                                <span className="font-medium text-gray-700">
                  Priority: {report.priority}
                </span>
                            </div>
                        </div>
                        <StatusBadge status={report.status} />
                    </div>

                    {/* Media */}
                    {report.mediaType !== 'none' && report.mediaUrl && (
                        <div className="mb-6 rounded-lg overflow-hidden">
                            {report.mediaType === 'image' ? (
                                <img
                                    src={report.mediaUrl}
                                    alt={report.title}
                                    className="w-full h-96 object-cover"
                                />
                            ) : (
                                <video src={report.mediaUrl} controls className="w-full h-96" />
                            )}
                        </div>
                    )}

                    {/* Description */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-3">Description</h2>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {report.description}
                        </p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Location</p>
                                    <p className="text-gray-900">{report.address.city}</p>
                                    {report.address.ward && (
                                        <p className="text-sm text-gray-600">
                                            Ward: {report.address.ward}
                                        </p>
                                    )}
                                    {report.address.street && (
                                        <p className="text-sm text-gray-600">
                                            {report.address.street}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Reported On</p>
                                    <p className="text-gray-900">
                                        {new Date(report.createdAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Reported By</p>
                                    <p className="text-gray-900">{report.reportedBy.name}</p>
                                </div>
                            </div>

                            {report.assignedTo && (
                                <div className="flex items-start gap-3">
                                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">
                                            Assigned To
                                        </p>
                                        <Link
                                            href={`/officials/${report.assignedTo._id}/scorecard`}
                                            className="text-blue-600 hover:underline"
                                        >
                                            {report.assignedTo.name}
                                        </Link>
                                        <p className="text-sm text-gray-600">
                                            {report.assignedTo.officialDetails?.designation}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                <TrendingUp className="w-5 h-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-500">
                                        Community Support
                                    </p>
                                    <p className="text-gray-900">{report.upvotes} upvotes</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Upvote Button */}
                    <button
                        onClick={handleUpvote}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                        <TrendingUp className="w-5 h-5" />
                        Support This Report ({report.upvotes})
                    </button>
                </div>
            </div>
        </div>
    );
}
