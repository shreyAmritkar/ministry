// ============================================
// app/reports/create/page.tsx
// ============================================
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Upload, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

export default function CreateReportPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        address: {
            street: '',
            area: '',
            ward: '',
            city: '',
            pincode: '',
        },
        latitude: '',
        longitude: '',
        priority: 'Medium',
    });
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Get user's current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setFormData((prev) => ({
                        ...prev,
                        latitude: position.coords.latitude.toString(),
                        longitude: position.coords.longitude.toString(),
                    }));
                },
                (error) => console.error('Location error:', error)
            );
        }
    }, []);

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setMediaFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setMediaPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let mediaData = null;

            // Upload media if present
            if (mediaFile) {
                const formDataMedia = new FormData();
                formDataMedia.append('media', mediaFile);

                const mediaResponse = await api.post('/media/upload', formDataMedia, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });

                mediaData = mediaResponse.data.data;
            }

            // Create report
            const reportData = {
                title: formData.title,
                description: formData.description,
                category: formData.category,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(formData.longitude), parseFloat(formData.latitude)],
                },
                address: formData.address,
                priority: formData.priority,
                ...(mediaData && {
                    mediaType: mediaData.mediaType,
                    mediaUrl: mediaData.mediaUrl,
                    cloudinaryId: mediaData.cloudinaryId,
                    gridfsId: mediaData.gridfsId,
                }),
            };

            const response = await api.post('/reports', reportData);

            // Redirect to report detail page
            router.push(`/reports/${response.data.data.report._id}`);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create report');
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        'Road_Damage',
        'Garbage_Collection',
        'Street_Lighting',
        'Water_Supply',
        'Drainage',
        'Illegal_Construction',
        'Public_Property_Damage',
        'Other',
    ];

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="container mx-auto px-4 max-w-3xl">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Report an Issue</h1>
                    <p className="text-gray-600 mb-8">
                        Help us improve your community by reporting civic issues
                    </p>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Issue Title *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Brief description of the issue"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Detailed Description *
                            </label>
                            <textarea
                                required
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Provide detailed information about the issue..."
                            />
                        </div>

                        {/* Category & Priority */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Category *
                                </label>
                                <select
                                    required
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Priority
                                </label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Critical">Critical</option>
                                </select>
                            </div>
                        </div>

                        {/* Location */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Location *
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    value={formData.latitude}
                                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Latitude"
                                />
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    value={formData.longitude}
                                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Longitude"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                <MapPin className="inline w-3 h-3" /> Location auto-detected
                            </p>
                        </div>

                        {/* Address */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                value={formData.address.ward}
                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, ward: e.target.value } })}
                                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ward *"
                                required
                            />
                            <input
                                type="text"
                                value={formData.address.city}
                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="City *"
                                required
                            />
                        </div>

                        {/* Media Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Upload Photo/Video (Optional)
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleMediaChange}
                                    className="hidden"
                                    id="media-upload"
                                />
                                <label
                                    htmlFor="media-upload"
                                    className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Click to upload
                                </label>
                                <p className="text-xs text-gray-500 mt-1">
                                    Images (max 10MB) or Videos (max 500MB)
                                </p>
                            </div>
                            {mediaPreview && (
                                <div className="mt-4">
                                    {mediaFile?.type.startsWith('image/') ? (
                                        <img src={mediaPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                                    ) : (
                                        <video src={mediaPreview} controls className="w-full h-48 object-cover rounded-lg" />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Submitting...' : 'Submit Report'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}