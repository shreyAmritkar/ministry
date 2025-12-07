// ============================================
// app/page.tsx - Landing Page
// ============================================
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, TrendingUp, Users, Shield } from 'lucide-react';
import api from '@/lib/api';

export default function LandingPage() {
    const [stats, setStats] = useState({
        totalReports: 0,
        solvedReports: 0,
        activeOfficials: 0,
    });



    const fetchStats = async () => {
        try {
            const response = await api.get('/analytics/dashboard');
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };
    useEffect(() => {
        fetchStats();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            {/* Hero Section */}
            <section className="container mx-auto px-4 py-20">
                <div className="text-center max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                        Your Voice for <span className="text-blue-600">Civic Change</span>
                    </h1>
                    <p className="text-xl text-gray-600 mb-8">
                        Report issues, track progress, and hold officials accountable.
                        Building better communities together.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Link
                            href="/reports/create"
                            className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                        >
                            Report an Issue
                        </Link>
                        <Link
                            href="/reports"
                            className="px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition"
                        >
                            View Reports
                        </Link>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="container mx-auto px-4 py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <StatCard
                        icon={<MapPin className="w-8 h-8" />}
                        number={stats.totalReports}
                        label="Issues Reported"
                        color="blue"
                    />
                    <StatCard
                        icon={<TrendingUp className="w-8 h-8" />}
                        number={stats.solvedReports}
                        label="Issues Resolved"
                        color="green"
                    />
                    <StatCard
                        icon={<Users className="w-8 h-8" />}
                        number={stats.activeOfficials}
                        label="Active Officials"
                        color="purple"
                    />
                </div>
            </section>

            {/* Features Section */}
            <section className="container mx-auto px-4 py-16">
                <h2 className="text-3xl font-bold text-center mb-12">
                    How CivicTrack Works
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard
                        step="1"
                        title="Report Issues"
                        description="Easily report civic issues with photos, videos, and location data."
                        icon="📸"
                    />
                    <FeatureCard
                        step="2"
                        title="Track Progress"
                        description="Get real-time updates on your reports and see officials take action."
                        icon="📊"
                    />
                    <FeatureCard
                        step="3"
                        title="Hold Accountable"
                        description="View official performance scorecards and ensure transparency."
                        icon="🏛️"
                    />
                </div>
            </section>

            {/* CTA Section */}
            <section className="bg-blue-600 text-white py-16">
                <div className="container mx-auto px-4 text-center">
                    <Shield className="w-16 h-16 mx-auto mb-6" />
                    <h2 className="text-3xl font-bold mb-4">
                        Join Thousands of Active Citizens
                    </h2>
                    <p className="text-xl mb-8 opacity-90">
                        Start making a difference in your community today
                    </p>
                    <Link
                        href="/register"
                        className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition inline-block"
                    >
                        Get Started Free
                    </Link>
                </div>
            </section>
        </div>
    );
}

function StatCard({ icon, number, label, color }: any) {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        purple: 'bg-purple-100 text-purple-600',
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition">
            <div className={`w-16 h-16 rounded-full ${colorClasses[color]} flex items-center justify-center mb-4`}>
                {icon}
            </div>
            <h3 className="text-4xl font-bold text-gray-900 mb-2">
                {number.toLocaleString()}
            </h3>
            <p className="text-gray-600">{label}</p>
        </div>
    );
}

function FeatureCard({ step, title, description, icon }: any) {
    return (
        <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition">
            <div className="text-5xl mb-4">{icon}</div>
            <div className="text-sm font-semibold text-blue-600 mb-2">STEP {step}</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">{title}</h3>
            <p className="text-gray-600">{description}</p>
        </div>
    );
}
