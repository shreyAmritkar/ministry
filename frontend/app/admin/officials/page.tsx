// ============================================
// app/admin/officials/page.tsx - Upload Officials (FINAL CLEANUP)
// ============================================
'use client';

import { useState } from 'react';
import { Upload, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function AdminOfficialsPage() {
    const [manualForm, setManualForm] = useState({
        // Official User Data
        name: '',
        email: '',
        phone: '',
        password: 'default123', // Default password
        designation: '',
        department: '',
        employeeId: '',

        // Tenure Data - CLEANED: Only city and zone remain as location fields
        city: '',
        zone: '', // Optional/retained for detail
        position: '',
        startDate: '',
        endDate: '',
    });

    const [bulkData, setBulkData] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // Create single official
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Step 1: Create official user
            const userResponse = await api.post('/auth/register', {
                name: manualForm.name,
                email: manualForm.email,
                phone: manualForm.phone,
                password: manualForm.password,
                userType: 'official',
                startDate: manualForm.startDate,
                officialDetails: {
                    designation: manualForm.designation,
                    department: manualForm.department,
                    employeeId: manualForm.employeeId,
                },
            });
            const officialId = userResponse.data.data.user._id;

            // Step 2: Create tenure - Removed ward/wardNumber
            await api.post('/tenures', {
                official: officialId,
                city: manualForm.city,
                zone: manualForm.zone || null, // Optional
                position: manualForm.position,
                department: manualForm.department,
                startDate: manualForm.startDate,
                endDate: manualForm.endDate || null,
            });

            setSuccess(`✅ Official ${manualForm.name} created successfully!`);

            // Reset form
            setManualForm({
                name: '',
                email: '',
                phone: '',
                password: 'default123',
                designation: '',
                department: '',
                employeeId: '',
                city: '',
                zone: '',
                position: '',
                startDate: '',
                endDate: '',
            });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create official');
        } finally {
            setLoading(false);
        }
    };

    // Bulk upload from JSON
    const handleBulkUpload = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const officials = JSON.parse(bulkData);
            let successCount = 0;
            let errorCount = 0;

            for (const official of officials) {
                try {
                    // Create user
                    const userResponse = await api.post('/auth/register', {
                        name: official.name,
                        email: official.email,
                        phone: official.phone,
                        password: official.password || 'default123',
                        userType: 'official',
                        officialDetails: {
                            designation: official.designation,
                            department: official.department,
                            employeeId: official.employeeId,
                        },
                    });
                    const officialId = userResponse.data.data.user._id;

                    // Create tenure - Removed ward/wardNumber
                    await api.post('/tenures', {
                        official: officialId,
                        city: official.city,
                        zone: official.zone || null,
                        position: official.position,
                        department: official.department,
                        startDate: official.startDate,
                        endDate: official.endDate || null,
                        contactInfo: {
                            phone: official.phone,
                            email: official.email,
                        },
                    });
                    successCount++;
                } catch (err) {
                    console.error(`Failed to create ${official.name}:`, err);
                    errorCount++;
                }
            }

            setSuccess(`✅ Created ${successCount} officials successfully! ${errorCount > 0 ? `(${errorCount} failed)` : ''}`);
            setBulkData('');
        } catch (err: any) {
            setError('Invalid JSON format or API error');
        } finally {
            setLoading(false);
        }
    };

    const designations = [
        'City Commissioner', // Renamed for better city-level fit
        'Deputy Commissioner',
        'Zone Officer',
        'City Engineer', // Renamed
        'Health Officer',
        'Sanitation Inspector',
    ];
    const positions =[
        'Mayor',
        'Municipal Commissioner',
        'CEO - Municipal Corporation',
        'Chairperson - Nagar Parishad',
        'Deputy Mayor',
        'Head of Public Works',
        'Other'
    ];
    const departments = [
        'Administration',
        'Engineering',
        'Health & Sanitation',
        'Water Supply',
        'Public Works',
        'Finance & Taxation',
        'Other'
    ];
    const zones = ['North', 'South', 'East', 'West', 'Central'];

    return (
        <ProtectedRoute requiredRole="admin">
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="container mx-auto px-4 max-w-6xl">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Upload Officials
                    </h1>
                    <p className="text-gray-600 mb-8">
                        Add municipal officials and assign them to cities
                    </p>

                    {/* Success/Error Messages (Omitted for brevity, assumed unchanged) */}
                    {success && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-green-800">{success}</p>
                        </div>
                    )}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Manual Entry */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <UserPlus className="w-6 h-6 text-blue-600" />
                                <h2 className="text-xl font-bold text-gray-900">
                                    Add Single Official
                                </h2>
                            </div>
                            <form onSubmit={handleManualSubmit} className="space-y-4">
                                {/* Personal Info fields (Name, Email, Phone, Designation, Department, Employee ID) remain the same */}

                                {/* Name/Email/Phone/Designation/Department/Employee ID fields here... */}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={manualForm.name}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, name: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="Rajesh Kumar"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Email *
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={manualForm.email}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, email: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="rajesh@city.gov"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Phone *
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={manualForm.phone}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, phone: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="9876543210"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Designation *
                                        </label>
                                        <select
                                            required
                                            value={manualForm.designation}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, designation: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Select...</option>
                                            {designations.map((d) => (
                                                <option key={d} value={d}>
                                                    {d}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Department *
                                        </label>
                                        <select
                                            required
                                            value={manualForm.department}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, department: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Select...</option>
                                            {departments.map((d) => (
                                                <option key={d} value={d}>
                                                    {d}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Employee ID
                                        </label>
                                        <input
                                            type="text"
                                            value={manualForm.employeeId}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, employeeId: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="EMP-12345"
                                        />
                                    </div>
                                </div>


                                {/* Tenure Info */}
                                <hr className="my-4" />

                                {/* CITY INPUT (Mandatory) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        City *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={manualForm.city}
                                        onChange={(e) =>
                                            setManualForm({ ...manualForm, city: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="New Delhi"
                                    />
                                </div>

                                {/* Zone and Position (Simplified layout) */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Zone (Optional)
                                        </label>
                                        <select
                                            value={manualForm.zone}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, zone: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Select...</option>
                                            {zones.map((z) => (
                                                <option key={z} value={z}>
                                                    {z}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Position *
                                        </label>
                                        <select
                                            required
                                            value={manualForm.position}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, position: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Select...</option>
                                            {positions.map((d) => (
                                                <option key={d} value={d}>
                                                    {d}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Start/End Date */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Start Date *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={manualForm.startDate}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, startDate: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            End Date (Optional)
                                        </label>
                                        <input
                                            type="date"
                                            value={manualForm.endDate}
                                            onChange={(e) =>
                                                setManualForm({ ...manualForm, endDate: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Official'}
                                </button>
                            </form>
                        </div>

                        {/* Bulk Upload */}
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <Upload className="w-6 h-6 text-blue-600" />
                                <h2 className="text-xl font-bold text-gray-900">
                                    Bulk Upload (JSON)
                                </h2>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Paste JSON Array
                                </label>
                                <textarea
                                    value={bulkData}
                                    onChange={(e) => setBulkData(e.target.value)}
                                    rows={15}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    // UPDATED JSON EXAMPLE (removed ward/wardNumber)
                                    placeholder={`[  {    "name": "Rajesh Kumar",    "email": "rajesh@city.gov",    "phone": "9876543210",    "designation": "City Commissioner",    "department": "Administration",    "employeeId": "EMP-001",    "city": "New Delhi",    "zone": "Central",    "position": "City Commissioner",    "startDate": "2024-01-01"  }]`}
                                />
                            </div>

                            <button
                                onClick={handleBulkUpload}
                                disabled={loading || !bulkData}
                                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {loading ? 'Uploading...' : 'Upload All Officials'}
                            </button>

                            {/* Example JSON */}
                            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                    📋 JSON Format Example:
                                </p>
                                <pre className="text-xs text-gray-600 overflow-x-auto">{`[  {    "name": "Rajesh Kumar",    "email": "rajesh@city.gov",    "phone": "9876543210",    "password": "default123",    "designation": "City Commissioner",    "department": "Administration",    "employeeId": "EMP-001",    "city": "New Delhi",
    "zone": "Central",    "position": "City Commissioner",    "startDate": "2024-01-01",    "endDate": null  }]`}
              </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}