// ============================================
// app/dashboard/page.tsx - User Dashboard
// ============================================
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { Report } from '@/types/report';
import ReportCard from '@/components/reports/ReportCard';

interface DashboardStats {
    total: number;
    pending: number;
    solved: number;
    inProgress: number;
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: 'blue' | 'yellow' | 'purple' | 'green';
}

export default function DashboardPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        total: 0,
        pending: 0,
        solved: 0,
        inProgress: 0,
    });

    useEffect(() => {
        fetchMyReports();
    }, []);

    const fetchMyReports = async () => {
        try {
            setLoading(true);
            const response = await api.get('/reports/user/my-reports');
            const myReports: Report[] = response.data.data;
            setReports(myReports);

            // Calculate stats
            setStats({
                total: myReports.length,
                pending: myReports.filter((r) => r.status === 'Pending').length,
                solved: myReports.filter((r) => r.status === 'Solved').length,
                inProgress: myReports.filter((r) => r.status === 'In_Progress').length,
            });
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">My Dashboard</h1>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        icon={<FileText className="w-6 h-6" />}
                        label="Total Reports"
                        value={stats.total}
                        color="blue"
                    />
                    <StatCard
                        icon={<Clock className="w-6 h-6" />}
                        label="Pending"
                        value={stats.pending}
                        color="yellow"
                    />
                    <StatCard
                        icon={<TrendingUp className="w-6 h-6" />}
                        label="In Progress"
                        value={stats.inProgress}
                        color="purple"
                    />
                    <StatCard
                        icon={<CheckCircle className="w-6 h-6" />}
                        label="Solved"
                        value={stats.solved}
                        color="green"
                    />
                </div>

                {/* Recent Reports */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">My Reports</h2>
                        <Link
                            href="/reports/create"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            + New Report
                        </Link>
                    </div>

                    {reports.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600 mb-4">You haven't reported any issues yet</p>
                            <Link
                                href="/reports/create"
                                className="text-blue-600 hover:underline"
                            >
                                Create your first report →
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {reports.map((report) => (
                                <ReportCard key={report._id} report={report} basePath="/reports" />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }: StatCardProps) {
    const colorClasses: Record<StatCardProps['color'], string> = {
        blue: 'bg-blue-100 text-blue-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        purple: 'bg-purple-100 text-purple-600',
        green: 'bg-green-100 text-green-600',
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <div
                className={`w-12 h-12 rounded-full ${colorClasses[color]} flex items-center justify-center mb-4`}
            >
                {icon}
            </div>
            <p className="text-gray-600 text-sm mb-1">{label}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
    );
}