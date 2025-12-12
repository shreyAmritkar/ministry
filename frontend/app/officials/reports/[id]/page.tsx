// ============================================
// app/official/reports/[id]/page.tsx - Official Report Detail Page (NEW)
// ============================================
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Calendar, User, TrendingUp, ArrowLeft, Zap } from 'lucide-react';
import api from '@/lib/api';
import { Report } from '@/types/report';
import StatusBadge from '@/components/reports/StatusBadge';
import OfficialReportActions from '@/components/reports/OfficialReportActions'; // <-- Official Action Component

export default function OfficialReportDetailPage() {
    const params = useParams();
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id) {
            fetchReport(params.id as string);
        }
    }, [params.id]);

    const fetchReport = async (id: string) => {
        try {
            setLoading(true);
            // Fetch the report using the public/general endpoint
            const response = await api.get(`/reports/${id}`);
            setReport(response.data.data);
        } catch (error) {
            console.error('Failed to fetch report:', error);
        } finally {
            setLoading(false);
        }
    };

    // Function to update the report status after an official action
    const handleReportUpdate = (updatedReport: Report) => {
        setReport(updatedReport);
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
                    {/* Link back to the official's report list */}
                    <Link href="/official/reports" className="text-blue-600 hover:underline">
                        ← Back to Assigned Reports
                    </Link>
                </div>
            </div>
        );
    }

    // Check if the current user (official) is the one assigned to this report
    // (A real application would check req.user._id against report.assignedTo._id in the API,
    // but for the frontend display, we rely on the route protection).
    const isAssignedToOfficial = report.assignedTo?._id === 'CURRENT_USER_ID';

    // NOTE: For now, we assume if the official is routed here, they are authorized to see/act.

    const officialDetails = report.assignedTo?.officialDetails;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4 max-w-6xl">
                {/* Back Button */}
                <Link
                    href="/official/dashboard"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Official Dashboard
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content Column */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-8 order-2 lg:order-1">

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
                        <div className="mb-6 border-t pt-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-3">Description</h2>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {report.description}
                            </p>
                        </div>

                        {/* Resolution Details (if claimed) */}
                        {report.resolutionDetails?.description && (
                            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                                <h3 className="text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                                    <Zap className="w-5 h-5"/> Official Resolution Claimed
                                </h3>
                                <p className="text-green-700 whitespace-pre-wrap mb-3">
                                    {report.resolutionDetails.description}
                                </p>
                                <p className="text-sm text-green-600">
                                    Status: {report.resolutionDetails.verificationStatus.replace(/_/g, ' ')}
                                </p>
                            </div>
                        )}

                    </div>

                    {/* Sidebar / Actions Column */}
                    <div className="lg:col-span-1 space-y-8 order-1 lg:order-2">

                        {/* 🎯 Official Actions Block 🎯 */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Official Actions</h2>
                            <OfficialReportActions
                                report={report}
                                onStatusUpdate={handleReportUpdate}
                            />
                        </div>

                        {/* Report Details */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Report Details</h2>
                            <DetailItem icon={MapPin} label="Location" value={report.address.city} subValue={report.address.street || report.address.ward} />
                            <DetailItem icon={Calendar} label="Reported On" value={new Date(report.createdAt).toLocaleDateString()} />
                            <DetailItem icon={User} label="Reported By" value={report.reportedBy.name} />

                            {/* Assigned Official Details */}
                            {report.assignedTo && (
                                <div className="mt-4 pt-4 border-t">
                                    <DetailItem
                                        icon={User}
                                        label="Assigned Official"
                                        value={
                                            <Link
                                                href={`/officials/${report.assignedTo._id}/scorecard`}
                                                className="text-blue-600 hover:underline font-semibold"
                                            >
                                                {report.assignedTo.name}
                                            </Link>
                                        }
                                        subValue={`${officialDetails?.designation || 'N/A'}, ${officialDetails?.department || 'N/A'}`}
                                    />
                                </div>
                            )}

                            {/* Upvotes (Read-only for official) */}
                            <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="w-5 h-5 text-gray-400" />
                                    <p className="text-sm font-medium text-gray-500">Community Support</p>
                                </div>
                                <p className="text-lg font-bold text-gray-900">{report.upvotes}</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper Component for Details
function DetailItem({ icon: Icon, label, value, subValue }: any) {
    return (
        <div className="flex items-start gap-3 py-2">
            <Icon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
            <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                {typeof value === 'string' ? <p className="text-gray-900">{value}</p> : value}
                {subValue && <p className="text-sm text-gray-600">{subValue}</p>}
            </div>
        </div>
    );
}