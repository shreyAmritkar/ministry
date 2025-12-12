// ============================================
// app/official/dashboard/page.tsx - Official Dashboard
// ============================================
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    FileText,
    CheckCircle,
    Clock,
    TrendingUp,
    Star,
    Zap,
    Users,
} from 'lucide-react';
import api from '@/lib/api';
import { Report, OfficialScorecard, ReportStatus } from '@/types/report';
import ReportCard from '@/components/reports/ReportCard';

// Define the specific stats needed for the Official Dashboard
interface DashboardStats {
    totalAssigned: number;
    pendingAction: number;
    inProgress: number;
    solved: number;
}

export default function OfficialDashboardPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [scorecard, setScorecard] = useState<OfficialScorecard | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalAssigned: 0,
        pendingAction: 0,
        inProgress: 0,
        solved: 0,
    });

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Assigned Reports (Used for immediate list and live stats)
            const reportsResponse = await api.get('/reports/official/my-assigned-reports');
            const assignedReports: Report[] = reportsResponse.data.data;
            setReports(assignedReports);

            // 2. Fetch Scorecard (Used for tenure stats and performance metrics)
            const scorecardResponse = await api.get('/officials/my-scorecard');
            const myScorecard: OfficialScorecard = scorecardResponse.data.data;
            setScorecard(myScorecard);

            // Calculate current dashboard stats based on the fetched reports
            const calculatedStats: DashboardStats = {
                totalAssigned: assignedReports.length,
                // Pending Action: Reports that need the official's first interaction.
                pendingAction: assignedReports.filter(
                    // 'Pending' is the initial user status; 'Reported' could be the initial official status
                    (r) => r.status === 'Pending' || r.status === 'Reported'
                ).length,
                // In Progress: Reports actively being worked on.
                inProgress: assignedReports.filter(
                    (r) => r.status === 'In_Progress' || r.status === 'Acknowledged'
                ).length,
                // Solved: Reports marked as complete (using live data, although scorecard has tenure total)
                solved: assignedReports.filter((r) => r.status === 'Solved').length,
            };
            setStats(calculatedStats);
        } catch (error) {
            console.error('Failed to fetch official dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
            </div>
        );
    }

    // Safely extract official details using optional chaining based on provided types
    const officialName = scorecard?.official.name || 'Official';
    const designation = scorecard?.official.position || 'N/A';
    const department = scorecard?.official.department || 'N/A';


    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Official Dashboard
                </h1>
                <p className="text-lg text-gray-600 mb-8">
                    Welcome back, {officialName}! <br/>({designation} , {department})
                </p>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        icon={<FileText className="w-6 h-6" />}
                        label="Total Reports Assigned"
                        value={stats.totalAssigned}
                        color="indigo"
                    />
                    <StatCard
                        icon={<Clock className="w-6 h-6" />}
                        label="Pending Action"
                        value={stats.pendingAction}
                        color="red"
                        tooltip="Reports in 'Pending' or 'Reported' status."
                    />
                    <StatCard
                        icon={<TrendingUp className="w-6 h-6" />}
                        label="Actively Working"
                        value={stats.inProgress}
                        color="yellow"
                        tooltip="Reports in 'Acknowledged' or 'In_Progress' status."
                    />
                    <StatCard
                        icon={<CheckCircle className="w-6 h-6" />}
                        label="Solved (Tenure Total)"
                        value={scorecard?.statistics.solved || 0}
                        color="green"
                    />
                </div>

                {/* Official Scorecard */}
                {scorecard && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        <ScoreCardSection title="Performance Snapshot" className="lg:col-span-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <ScoreIndicator
                                    icon={<Star className="w-6 h-6 text-yellow-500" />}
                                    label="Efficiency Score"
                                    value={scorecard.statistics.efficiencyScore.toFixed(2)}
                                    subLabel="Out of 100"
                                />
                                <ScoreIndicator
                                    icon={<Zap className="w-6 h-6 text-blue-500" />}
                                    label="Avg. Resolution Time"
                                    value={scorecard.statistics.averageResolutionTime}
                                    subLabel="HH:MM:SS"
                                />
                                <ScoreIndicator
                                    icon={<Users className="w-6 h-6 text-purple-500" />}
                                    label="Current Ward"
                                    value={scorecard.currentTenure?.ward || 'Global'}
                                    subLabel={scorecard.currentTenure?.position || 'Assignment'}
                                />
                            </div>
                        </ScoreCardSection>

                        <ScoreCardSection title="Ratings" className="flex flex-col space-y-4">
                            <RatingDisplay
                                label="Overall Efficiency"
                                rating={scorecard.ratings.efficiency.rating}
                                grade={scorecard.ratings.efficiency.grade}
                                color="blue"
                            />
                            <RatingDisplay
                                label="Resolution Speed"
                                rating={scorecard.ratings.speed.rating}
                                grade={scorecard.ratings.speed.grade}
                                color="yellow"
                            />
                        </ScoreCardSection>
                    </div>
                )}

                {/* Reports Awaiting Action List */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">
                            Reports Assigned to Me ({reports.length})
                        </h2>
                        <Link
                            href="/official/reports"
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                        >
                            View All Reports →
                        </Link>
                    </div>

                    {reports.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600 mb-4">
                                Excellent! You currently have no reports requiring action.
                            </p>
                            <p className="text-green-600 font-semibold">Keep up the great work!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Display the most recent reports (e.g., first 6) */}
                            {reports.slice(0, 6).map((report) => (
                                <ReportCard
                                    key={report._id}
                                    report={report}
                                    basePath="/officials/reports" // <-- Set the official path here
                                />
                            ))}
                        </div>
                    )}
                    {reports.length > 6 && (
                        <div className="text-center mt-6">
                            <Link
                                href="/official/reports"
                                className="text-green-600 hover:underline"
                            >
                                Show more reports ({reports.length - 6} hidden) →
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Helper Components (Reused/Adapted from User Dashboard) ---

function StatCard({ icon, label, value, color, tooltip }: any) {
    const colorClasses = {
        indigo: 'bg-indigo-100 text-indigo-600',
        red: 'bg-red-100 text-red-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        green: 'bg-green-100 text-green-600',
    };

    return (
        <div
            className="bg-white p-6 rounded-xl shadow-md relative group"
            title={tooltip}
        >
            <div
                className={`w-12 h-12 rounded-full ${colorClasses[color]} flex items-center justify-center mb-4`}
            >
                {icon}
            </div>
            <p className="text-gray-600 text-sm mb-1">{label}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {tooltip && (
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300 whitespace-nowrap z-10">
                    {tooltip}
                </span>
            )}
        </div>
    );
}

function ScoreCardSection({ title, children, className = '' }: any) {
    return (
        <div className={`bg-white p-6 rounded-xl shadow-md ${className}`}>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                {title}
            </h3>
            {children}
        </div>
    );
}

function ScoreIndicator({ icon, label, value, subLabel }: any) {
    return (
        <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400">{subLabel}</p>
            </div>
        </div>
    );
}

function RatingDisplay({ label, rating, grade, color }: any) {
    const colorClasses = {
        blue: 'border-blue-500 text-blue-700 bg-blue-50',
        yellow: 'border-yellow-500 text-yellow-700 bg-yellow-50',
    };

    return (
        <div className={`p-4 border-l-4 rounded-r-lg ${colorClasses[color]}`}>
            <p className="text-sm font-medium mb-1">{label}</p>
            <div className="flex justify-between items-center">
                <span className="text-xl font-extrabold">{rating}</span>
                <span className="px-3 py-1 text-xs font-bold uppercase rounded-full bg-white shadow-sm">
                    Grade: {grade}
                </span>
            </div>
        </div>
    );
}