// ============================================
// lib/geocoding.ts
// FREE Geocoding using Nominatim (OpenStreetMap)
// NO API KEY REQUIRED
// ============================================

interface GeocodingResult {
    latitude: number;
    longitude: number;
    displayName: string;
    address: {
        city?: string;
        state?: string;
        country?: string;
        suburb?: string;
        neighbourhood?: string;
        postcode?: string;
    };
}

interface ReverseGeocodingResult {
    ward: string;
    city: string;
    state: string;
    country: string;
    postcode?: string;
    displayName: string;
}

/**
 * Forward Geocoding: Address → Coordinates
 * Uses Nominatim (OpenStreetMap) - Completely FREE
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(address)}` +
            `&format=json` +
            `&limit=1` +
            `&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'CivicTrack-App/1.0' // Required by Nominatim
                }
            }
        );

        const data = await response.json();

        if (data.length === 0) {
            return null;
        }

        const result = data[0];

        return {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            displayName: result.display_name,
            address: {
                city: result.address.city || result.address.town || result.address.village,
                state: result.address.state,
                country: result.address.country,
                suburb: result.address.suburb,
                neighbourhood: result.address.neighbourhood,
                postcode: result.address.postcode
            }
        };
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

/**
 * Reverse Geocoding: Coordinates → Address
 * Uses Nominatim (OpenStreetMap) - Completely FREE
 */
export async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<ReverseGeocodingResult | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?` +
            `lat=${latitude}` +
            `&lon=${longitude}` +
            `&format=json` +
            `&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'CivicTrack-App/1.0'
                }
            }
        );

        const data = await response.json();

        if (!data || data.error) {
            return null;
        }

        // Extract ward/zone information
        const ward = data.address.suburb ||
            data.address.neighbourhood ||
            data.address.quarter ||
            data.address.district ||
            `Ward-${Math.floor(Math.random() * 50) + 1}`; // Fallback

        return {
            ward: ward,
            city: data.address.city || data.address.town || data.address.village || 'Unknown',
            state: data.address.state || 'Unknown',
            country: data.address.country || 'Unknown',
            postcode: data.address.postcode,
            displayName: data.display_name
        };
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return null;
    }
}

/**
 * Get current user location using browser's Geolocation API
 * NO API KEY REQUIRED
 */
export function getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

/**
 * Search for places using Nominatim
 */
export async function searchPlaces(query: string, limit: number = 5) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query)}` +
            `&format=json` +
            `&limit=${limit}` +
            `&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'CivicTrack-App/1.0'
                }
            }
        );

        const data = await response.json();

        return data.map((item: any) => ({
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            displayName: item.display_name,
            address: item.address
        }));
    } catch (error) {
        console.error('Place search error:', error);
        return [];
    }
}
