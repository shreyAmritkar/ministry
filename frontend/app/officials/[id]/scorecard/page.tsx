// ============================================
// app/officials/[id]/scorecard/page.tsx
// Official Scorecard Page
// ============================================
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { TrendingUp, Award, Clock, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { OfficialScorecard } from '@/types/report';
import EfficiencyGauge from '@/components/officials/EfficiencyGauge';
import PerformanceChart from '@/components/officials/PerformanceChart';
import CategoryBreakdown from '@/components/officials/CategoryBreakdown';

interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: 'blue' | 'green' | 'purple' | 'yellow';
}

export default function OfficialScorecardPage() {
    const params = useParams();
    const [scorecard, setScorecard] = useState<OfficialScorecard | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id) {
            fetchScorecard(params.id as string);
        }
    }, [params.id]);

    const fetchScorecard = async (officialId: string) => {
        try {
            setLoading(true);
            const response = await api.get(`/officials/${officialId}/scorecard`);
            setScorecard(response.data.data);
        } catch (error) {
            console.error('Failed to fetch scorecard:', error);
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

    if (!scorecard) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-600">Scorecard not found</p>
            </div>
        );
    }

    const { official, currentTenure, statistics, ratings, categoryPerformance, performanceTrend } = scorecard;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
                <div className="container mx-auto px-4 py-12">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2">{official.name}</h1>
                            <p className="text-xl opacity-90 mb-4">
                                {official.position} • {official.department}
                            </p>
                            {currentTenure && (
                                <div className="flex items-center gap-4 text-sm opacity-80">
                                    <span>📍 {currentTenure.ward}</span>
                                    <span>•</span>
                                    <span>
                                        Since {new Date(currentTenure.startDate).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-6xl font-bold mb-2">
                                {statistics.efficiencyScore.toFixed(1)}%
                            </div>
                            <div className="text-xl opacity-90">Efficiency Score</div>
                            <div className={`inline-block px-4 py-1 rounded-full mt-2 ${getGradeColor(ratings.efficiency.grade)}`}>
                                Grade {ratings.efficiency.grade}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <MetricCard
                        icon={<CheckCircle className="w-6 h-6" />}
                        label="Total Reported"
                        value={statistics.totalReported}
                        color="blue"
                    />
                    <MetricCard
                        icon={<TrendingUp className="w-6 h-6" />}
                        label="Solved"
                        value={statistics.solved}
                        color="green"
                    />
                    <MetricCard
                        icon={<Clock className="w-6 h-6" />}
                        label="Avg Resolution"
                        value={statistics.averageResolutionTime}
                        color="purple"
                    />
                    <MetricCard
                        icon={<Award className="w-6 h-6" />}
                        label="Pending"
                        value={statistics.pending}
                        color="yellow"
                    />
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold mb-6">Efficiency Gauge</h2>
                        <EfficiencyGauge score={statistics.efficiencyScore} />
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold mb-6">Performance Trend</h2>
                        <PerformanceChart data={performanceTrend} />
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold mb-6">Category-wise Performance</h2>
                    <CategoryBreakdown data={categoryPerformance} />
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, color }: MetricCardProps) {
    const colorClasses: Record<MetricCardProps['color'], string> = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        purple: 'bg-purple-100 text-purple-600',
        yellow: 'bg-yellow-100 text-yellow-600',
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className={`w-12 h-12 rounded-full ${colorClasses[color]} flex items-center justify-center mb-4`}>
                {icon}
            </div>
            <p className="text-gray-600 text-sm mb-1">{label}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
    );
}

function getGradeColor(grade: string): string {
    if (grade.startsWith('A')) return 'bg-green-500 text-white';
    if (grade.startsWith('B')) return 'bg-blue-500 text-white';
    if (grade.startsWith('C')) return 'bg-yellow-500 text-white';
    return 'bg-red-500 text-white';
}