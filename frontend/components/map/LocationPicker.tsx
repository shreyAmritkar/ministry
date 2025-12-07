// ============================================
// components/map/LocationPicker.tsx
// Interactive location picker component
// ============================================
'use client';

import { useState, useEffect } from 'react';
import { MapPin, Search, Loader, Navigation } from 'lucide-react';
import { getCurrentLocation, reverseGeocode, searchPlaces } from '@/lib/geocoding';

interface LocationPickerProps {
    onLocationSelect: (location: {
        latitude: number;
        longitude: number;
        ward: string;
        city: string;
        displayName: string;
    }) => void;
    initialLatitude?: number;
    initialLongitude?: number;
}

export default function LocationPicker({
                                           onLocationSelect,
                                           initialLatitude,
                                           initialLongitude
                                       }: LocationPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [selectedAddress, setSelectedAddress] = useState('');

    useEffect(() => {
        if (initialLatitude && initialLongitude) {
            setCurrentLocation({
                latitude: initialLatitude,
                longitude: initialLongitude
            });
            loadAddressForLocation(initialLatitude, initialLongitude);
        }
    }, [initialLatitude, initialLongitude]);

    const loadAddressForLocation = async (lat: number, lng: number) => {
        const result = await reverseGeocode(lat, lng);
        if (result) {
            setSelectedAddress(result.displayName);
        }
    };

    const handleGetCurrentLocation = async () => {
        setLoading(true);
        try {
            const location = await getCurrentLocation();
            setCurrentLocation(location);

            const addressData = await reverseGeocode(location.latitude, location.longitude);

            if (addressData) {
                setSelectedAddress(addressData.displayName);
                onLocationSelect({
                    latitude: location.latitude,
                    longitude: location.longitude,
                    ward: addressData.ward,
                    city: addressData.city,
                    displayName: addressData.displayName
                });
            }
        } catch (error) {
            console.error('Location error:', error);
            alert('Unable to get your location. Please search manually.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const results = await searchPlaces(searchQuery);
            setSearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectResult = async (result: any) => {
        setCurrentLocation({
            latitude: result.latitude,
            longitude: result.longitude
        });
        setSelectedAddress(result.displayName);
        setSearchResults([]);
        setSearchQuery('');

        const addressData = await reverseGeocode(result.latitude, result.longitude);

        if (addressData) {
            onLocationSelect({
                latitude: result.latitude,
                longitude: result.longitude,
                ward: addressData.ward,
                city: addressData.city,
                displayName: addressData.displayName
            });
        }
    };

    return (
        <div className="space-y-4">
            {/* Current Location Display */}
            {currentLocation && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-green-900 mb-1">Selected Location</p>
                            <p className="text-xs text-green-700">{selectedAddress}</p>
                            <p className="text-xs text-green-600 mt-1">
                                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search for a location..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                    {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Search'}
                </button>
            </div>

            {/* Get Current Location Button */}
            <button
                onClick={handleGetCurrentLocation}
                disabled={loading}
                className="w-full py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
                <Navigation className="w-5 h-5" />
                Use My Current Location
            </button>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((result, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelectResult(result)}
                            className="w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition"
                        >
                            <div className="flex items-start gap-3">
                                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {result.address.name || result.address.suburb || result.address.neighbourhood}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">{result.displayName}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
