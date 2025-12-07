// ============================================
// components/reports/ReportFilters.tsx
// ============================================
'use client';

import { X } from 'lucide-react';

interface ReportFiltersProps {
    filters: {
        status: string;
        category: string;
        ward: string;
        priority: string;
    };
    onFilterChange: (filters: any) => void;
    onClose: () => void;
}

export default function ReportFilters({ filters, onFilterChange, onClose }: ReportFiltersProps) {
    const statuses = ['Pending', 'Acknowledged', 'In_Progress', 'Solved', 'Rejected'];
    const categories = [
        'Road_Damage',
        'Garbage_Collection',
        'Street_Lighting',
        'Water_Supply',
        'Drainage',
        'Illegal_Construction',
    ];
    const priorities = ['Low', 'Medium', 'High', 'Critical'];

    const handleChange = (key: string, value: string) => {
        onFilterChange({ ...filters, [key]: value });
    };

    const handleReset = () => {
        onFilterChange({ status: '', category: '', ward: '', priority: '' });
    };

    return (
        <div className="bg-white border-b border-gray-200 p-4">
            <div className="container mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Filters</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Status
                        </label>
                        <select
                            value={filters.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Statuses</option>
                            {statuses.map((status) => (
                                <option key={status} value={status}>
                                    {status.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category
                        </label>
                        <select
                            value={filters.category}
                            onChange={(e) => handleChange('category', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Categories</option>
                            {categories.map((category) => (
                                <option key={category} value={category}>
                                    {category.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Ward Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ward
                        </label>
                        <input
                            type="text"
                            value={filters.ward}
                            onChange={(e) => handleChange('ward', e.target.value)}
                            placeholder="Enter ward name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Priority Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Priority
                        </label>
                        <select
                            value={filters.priority}
                            onChange={(e) => handleChange('priority', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Priorities</option>
                            {priorities.map((priority) => (
                                <option key={priority} value={priority}>
                                    {priority}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                        Reset Filters
                    </button>
                </div>
            </div>
        </div>
    );
}
