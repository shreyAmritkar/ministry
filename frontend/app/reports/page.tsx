// ============================================
// app/reports/page.tsx - Reports List with Map
// ============================================
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Filter, List, Map as MapIcon } from 'lucide-react';
import api from '@/lib/api';
import { Report } from '@/types/report';
import ReportCard from '@/components/reports/ReportCard';
import ReportFilters from '@/components/reports/ReportFilters';

// Dynamic import for map to avoid SSR issues
const InteractiveMap = dynamic(
    () => import('@/components/map/InteractiveMap'),
    { ssr: false }
);

export default function ReportsPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [filteredReports, setFilteredReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        status: '',
        category: '',
        ward: '',
        priority: '',
    });

    useEffect(() => {
        fetchReports();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [reports, filters]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const response = await api.get('/reports');
            setReports(response.data.data);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...reports];

        if (filters.status) {
            filtered = filtered.filter(r => r.status === filters.status);
        }
        if (filters.category) {
            filtered = filtered.filter(r => r.category === filters.category);
        }
        if (filters.ward) {
            filtered = filtered.filter(r => r.address.ward === filters.ward);
        }
        if (filters.priority) {
            filtered = filtered.filter(r => r.priority === filters.priority);
        }

        setFilteredReports(filtered);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Civic Reports
                            </h1>
                            <p className="text-gray-600">
                                {filteredReports.length} reports found
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                            >
                                <Filter className="w-4 h-4" />
                                Filters
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                                    viewMode === 'list'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white border border-gray-300'
                                }`}
                            >
                                <List className="w-4 h-4" />
                                List
                            </button>
                            <button
                                onClick={() => setViewMode('map')}
                                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                                    viewMode === 'map'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white border border-gray-300'
                                }`}
                            >
                                <MapIcon className="w-4 h-4" />
                                Map
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <ReportFilters
                    filters={filters}
                    onFilterChange={setFilters}
                    onClose={() => setShowFilters(false)}
                />
            )}

            {/* Content */}
            <div className="container mx-auto px-4 py-8">
                {viewMode === 'list' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredReports.map((report) => (
                            <ReportCard key={report._id} report={report} />
                        ))}
                    </div>
                ) : (
                    <div className="h-[calc(100vh-200px)] rounded-xl overflow-hidden shadow-lg">
                        <InteractiveMap reports={filteredReports} />
                    </div>
                )}
            </div>
        </div>
    );
}