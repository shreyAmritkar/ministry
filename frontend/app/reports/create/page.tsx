// ============================================
// app/reports/create/page.tsx (FIXED - Proper Order)
// ============================================
'use client';

import { useState , useRef} from 'react';
import { useRouter } from 'next/navigation';
import { Upload, AlertCircle, Loader } from 'lucide-react';
import api from '@/lib/api';
import LocationPicker from '@/components/map/LocationPicker';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

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
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLocationSelect = (location: any) => {
        setFormData((prev) => ({
            ...prev,
            latitude: location.latitude.toString(),
            longitude: location.longitude.toString(),
            address: {
                ...prev.address,
                ward: location.ward,
                city: location.city,
            }
        }));
        // Clear location validation errors
        setValidationErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.location;
            delete newErrors.ward;
            return newErrors;
        });
    };

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Client-side file validation
            const maxSize = file.type.startsWith('image/') ? 10 * 1024 * 1024 : 500 * 1024 * 1024;

            if (file.size > maxSize) {
                setValidationErrors(prev => ({
                    ...prev,
                    media: `File size exceeds ${file.type.startsWith('image/') ? '10MB' : '500MB'} limit`
                }));
                return;
            }

            const allowedTypes = [
                'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
                'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'
            ];

            if (!allowedTypes.includes(file.type)) {
                setValidationErrors(prev => ({
                    ...prev,
                    media: 'Invalid file type. Only images (JPEG, PNG, WebP, GIF) and videos (MP4, MPEG, MOV, WebM) are allowed'
                }));
                return;
            }

            setMediaFile(file);
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.media;
                return newErrors;
            });

            // Generate preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setMediaPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // STEP 1: CLIENT-SIDE VALIDATION (Before anything else!)
    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        // Title validation
        if (!formData.title.trim()) {
            errors.title = 'Title is required';
        } else if (formData.title.length < 5) {
            errors.title = 'Title must be at least 5 characters';
        } else if (formData.title.length > 200) {
            errors.title = 'Title cannot exceed 200 characters';
        }

        // Description validation
        if (!formData.description.trim()) {
            errors.description = 'Description is required';
        } else if (formData.description.length < 20) {
            errors.description = 'Description must be at least 20 characters';
        } else if (formData.description.length > 2000) {
            errors.description = 'Description cannot exceed 2000 characters';
        }

        // Category validation
        if (!formData.category) {
            errors.category = 'Please select a category';
        }

        // Location validation
        if (!formData.latitude || !formData.longitude) {
            errors.location = 'Please select a location';
        }

        // Ward validation
        if (!formData.address.ward) {
            errors.ward = 'Ward information is required';
        }

        // City validation
        if (!formData.address.city) {
            errors.city = 'City information is required';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setUploadProgress(0);

        // STEP 1: Validate form first (NO API calls yet!)
        if (!validateForm()) {
            setError('Please fix the errors above before submitting');
            return;
        }

        setLoading(true);

        try {
            let mediaData = null;

            // STEP 2: Upload media ONLY after validation passes
            if (mediaFile) {
                setUploadProgress(10);
                console.log('📤 Starting media upload...');

                const formDataMedia = new FormData();
                formDataMedia.append('media', mediaFile);

                try {
                    const mediaResponse = await api.post('/media/upload', formDataMedia, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        onUploadProgress: (progressEvent) => {
                            const progress = progressEvent.total
                                ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                                : 0;
                            setUploadProgress(progress);
                        }
                    });

                    mediaData = mediaResponse.data.data;
                    console.log('✅ Media uploaded successfully');
                } catch (uploadError: any) {
                    console.error('❌ Media upload failed:', uploadError);
                    throw new Error(
                        uploadError.response?.data?.message || 'Failed to upload media. Please try again.'
                    );
                }
            }

            // STEP 3: Create report with uploaded media data
            console.log('📝 Creating report...');
            const reportData = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                category: formData.category,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(formData.longitude), parseFloat(formData.latitude)],
                },
                address: {
                    ward: formData.address.ward,
                    city: formData.address.city,
                    street: formData.address.street,
                    area: formData.address.area,
                    pincode: formData.address.pincode,
                },
                priority: formData.priority,
                ...(mediaData && {
                    mediaType: mediaData.mediaType,
                    mediaUrl: mediaData.mediaUrl,
                    cloudinaryId: mediaData.cloudinaryId,
                    gridfsId: mediaData.gridfsId,
                }),
            };

            const response = await api.post('/reports', reportData);
            console.log('✅ Report created successfully');

            // STEP 4: Navigate to success page
            router.push(`/reports/${response.data.data.report._id}`);
        } catch (err: any) {
            console.error('Error:', err);
            setError(err.message || err.response?.data?.message || 'Failed to create report');
            setUploadProgress(0);
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
        <ProtectedRoute>
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
                                onChange={(e) => {
                                    setFormData({ ...formData, title: e.target.value });
                                    if (validationErrors.title) {
                                        setValidationErrors(prev => {
                                            const newErrors = { ...prev };
                                            delete newErrors.title;
                                            return newErrors;
                                        });
                                    }
                                }}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                    validationErrors.title ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Brief description of the issue"
                            />
                            {validationErrors.title && (
                                <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                                {formData.title.length}/200 characters
                            </p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Detailed Description *
                            </label>
                            <textarea
                                required
                                value={formData.description}
                                onChange={(e) => {
                                    setFormData({ ...formData, description: e.target.value });
                                    if (validationErrors.description) {
                                        setValidationErrors(prev => {
                                            const newErrors = { ...prev };
                                            delete newErrors.description;
                                            return newErrors;
                                        });
                                    }
                                }}
                                rows={4}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                    validationErrors.description ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Provide detailed information about the issue..."
                            />
                            {validationErrors.description && (
                                <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                                {formData.description.length}/2000 characters
                            </p>
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
                                    onChange={(e) => {
                                        setFormData({ ...formData, category: e.target.value });
                                        if (validationErrors.category) {
                                            setValidationErrors(prev => {
                                                const newErrors = { ...prev };
                                                delete newErrors.category;
                                                return newErrors;
                                            });
                                        }
                                    }}
                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                        validationErrors.category ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                >
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                                {validationErrors.category && (
                                    <p className="mt-1 text-sm text-red-600">{validationErrors.category}</p>
                                )}
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

                        {/* Location Picker */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Location * (No API Key Required)
                            </label>
                            <LocationPicker
                                onLocationSelect={handleLocationSelect}
                                initialLatitude={formData.latitude ? parseFloat(formData.latitude) : undefined}
                                initialLongitude={formData.longitude ? parseFloat(formData.longitude) : undefined}
                            />
                            {validationErrors.location && (
                                <p className="mt-1 text-sm text-red-600">{validationErrors.location}</p>
                            )}
                            {validationErrors.ward && (
                                <p className="mt-1 text-sm text-red-600">{validationErrors.ward}</p>
                            )}
                        </div>

                        {/* Media Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Upload Photo/Video (Optional)
                            </label>
                            {!mediaPreview ? (
                            <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
                                validationErrors.media ? 'border-red-500' : 'border-gray-300'
                            }`}>
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleMediaChange}
                                    className="hidden"
                                    id="media-upload"
                                    disabled={loading}
                                    ref={fileInputRef}
                                />
                                <label
                                    htmlFor="media-upload"
                                    className={`cursor-pointer text-blue-600 hover:text-blue-700 font-medium ${
                                        loading ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                >
                                    Click to upload
                                </label>
                                <p className="text-xs text-gray-500 mt-1">
                                    Images (max 10MB) or Videos (max 500MB)
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Supported: JPEG, PNG, WebP, GIF, MP4, MPEG, MOV, WebM
                                </p>
                            </div>
                            ) : null}
                            {validationErrors.media && (
                                <p className="mt-1 text-sm text-red-600">{validationErrors.media}</p>
                            )}

                            {mediaPreview && (
                                <div className="mt-4">
                                    {mediaFile?.type.startsWith('image/') ? (
                                        <img src={mediaPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                                    ) : (
                                        <video src={mediaPreview} controls className="w-full h-48 object-cover rounded-lg" />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMediaFile(null);
                                            setMediaPreview('');
                                            // 💡 FIX: Reset the file input value
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                        }}
                                        className="mt-2 text-sm text-red-600 hover:text-red-700"
                                    >
                                        Remove file
                                    </button>
                                </div>
                            )}

                            {/* Upload Progress */}
                            {loading && uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="mt-4">
                                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>Uploading media...</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    {uploadProgress > 0 && uploadProgress < 100
                                        ? 'Uploading media...'
                                        : 'Creating report...'}
                                </>
                            ) : (
                                'Submit Report'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
            </ProtectedRoute>
    );
}