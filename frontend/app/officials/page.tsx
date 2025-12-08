// ============================================
// app/officials/page.tsx - Officials Directory (MODIFIED FOR CITY-LEVEL)
// ============================================
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, MapPin, Award, Filter } from 'lucide-react';
import api from '@/lib/api';

interface Official {
    _id: string;
    name: string;
    email: string;
    phone: string;
    officialDetails: {
        designation: string;
        department: string;
        city: string; // Ensure city is available here too if needed
    };
}

interface Tenure {
    _id: string;
    official: Official;
    city: string; // ⬅️ CHANGED: ward -> city
    position: string;
    department: string;
    isActive: boolean;
    startDate: string;
}

export default function OfficialsPage() {
    const [tenures, setTenures] = useState<Tenure[]>([]);
    const [filteredTenures, setFilteredTenures] = useState<Tenure[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCity, setFilterCity] = useState(''); // ⬅️ CHANGED: filterWard -> filterCity
    const [filterDepartment, setFilterDepartment] = useState('');

    useEffect(() => {
        fetchOfficials();
    }, []);

    useEffect(() => {
        // ⬅️ CHANGED: filterWard -> filterCity
        applyFilters();
    }, [tenures, searchQuery, filterCity, filterDepartment]);

    const fetchOfficials = async () => {
        try {
            setLoading(true);
            // Fetches active tenures (now city-based)
            const response = await api.get('/tenures?isActive=true');
            setTenures(response.data.data);
        } catch (error) {
            console.error('Failed to fetch officials:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...tenures];
        if (searchQuery) {
            filtered = filtered.filter(
                (t) =>
                    t.official.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.city.toLowerCase().includes(searchQuery.toLowerCase()) || // ⬅️ CHANGED: t.ward -> t.city
                    t.position.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        if (filterCity) { // ⬅️ CHANGED: filterWard -> filterCity
            filtered = filtered.filter((t) => t.city === filterCity); // ⬅️ CHANGED: t.ward -> t.city
        }
        if (filterDepartment) {
            filtered = filtered.filter((t) => t.department === filterDepartment);
        }
        setFilteredTenures(filtered);
    };

    // ⬅️ CHANGED: uniqueWards -> uniqueCities
    const uniqueCities = Array.from(new Set(tenures.map((t) => t.city))).sort();
    const uniqueDepartments = Array.from(new Set(tenures.map((t) => t.department))).sort();

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
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl font-bold mb-2">Municipal Officials</h1>
                    <p className="text-xl opacity-90">
                        Meet the officials serving your community
                    </p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="container mx-auto px-4 py-8">
                <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                // ⬅️ CHANGED: placeholder reflects city/position
                                placeholder="Search by name, city, or position..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* City Filter */} {/* ⬅️ CHANGED: Ward Filter -> City Filter */}
                        <select
                            value={filterCity} // ⬅️ CHANGED: filterWard -> filterCity
                            onChange={(e) => setFilterCity(e.target.value)} // ⬅️ CHANGED: setFilterWard -> setFilterCity
                            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Cities</option> {/* ⬅️ CHANGED: All Wards -> All Cities */}
                            {uniqueCities.map((city) => ( // ⬅️ CHANGED: uniqueWards -> uniqueCities
                                <option key={city} value={city}>
                                    {city}
                                </option>
                            ))}
                        </select>

                        {/* Department Filter (Retained) */}
                        <select
                            value={filterDepartment}
                            onChange={(e) => setFilterDepartment(e.target.value)}
                            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Departments</option>
                            {uniqueDepartments.map((dept) => (
                                <option key={dept} value={dept}>
                                    {dept}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Results Count (Retained) */}
                    <div className="mt-4 text-sm text-gray-600">
                        Showing {filteredTenures.length} of {tenures.length} officials
                    </div>
                </div>

                {/* Officials Grid (Retained) */}
                {filteredTenures.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-600">No officials found matching your criteria</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTenures.map((tenure) => (
                            <OfficialCard key={tenure._id} tenure={tenure} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function OfficialCard({ tenure }: { tenure: Tenure }) {
    return (
        <Link href={`/officials/${tenure.official._id}/scorecard`}>
            <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition p-6 cursor-pointer">
                {/* Avatar (Retained) */}
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
          <span className="text-white text-2xl font-bold">
            {tenure.official.name.charAt(0)}
          </span>
                </div>

                {/* Info (Retained) */}
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {tenure.official.name}
                </h3>
                <p className="text-blue-600 font-medium mb-3">{tenure.position}</p>
                <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{tenure.city}</span> {/* ⬅️ CHANGED: tenure.ward -> tenure.city */}
                    </div>
                    <div className="flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        <span>{tenure.department}</span>
                    </div>
                </div>

                {/* View Scorecard Button (Retained) */}
                <button className="mt-4 w-full bg-blue-50 text-blue-600 py-2 rounded-lg font-medium hover:bg-blue-100 transition">
                    View Performance Scorecard →
                </button>
            </div>
        </Link>
    );
}