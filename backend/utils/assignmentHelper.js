// ============================================
// utils/assignmentHelper.js
// Core Assignment Utility Functions (MODIFIED FOR CITY-LEVEL)
// ============================================
const OfficialTenure = require('../models/OfficialTenure');
const ApiError = require('./ApiError');
const axios = require('axios');
// NOTE: Ensure you have an environmental variable for the geocoding service key.

/**
 * Reverse geocoding utility to get CITY and Pincode from coordinates
 */
const getCityFromCoordinates = async (latitude, longitude) => {
    // --- BEST PRACTICE: Use a dedicated, reliable Geocoding API ---
    // For production, use a service like Nominatim/OpenStreetMap, Geoapify, or Mapbox.
    const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

    try {
        const response = await axios.get(NOMINATIM_URL, {
            params: {
                lat: latitude,
                lon: longitude,
                format: 'json',
                addressdetails: 1,
                // Add an appropriate user agent for non-Google/Mapbox services
                'accept-language': 'en-US'
            },
            // Set a user agent to comply with Nominatim's usage policy
            headers: {
                'User-Agent': 'CivicAccountabilityPlatform/1.0'
            }
        });

        const address = response.data.address;

        if (!address) {
            throw new ApiError('Geocoding service returned no address data.', 404);
        }

        // Extract required components. Different services use different keys.
        const city = address.city || address.town || address.village || address.municipality;
        const pincode = address.postcode;
        const state = address.state;

        if (!city) {
            throw new ApiError('Geocoding service could not determine the City.', 404);
        }

        return { city, pincode, state };

    } catch (error) {
        console.error('City lookup error:', error.message);
        // Throw 500 only if the external API call failed (not for 404 data not found)
        if (error.response && error.response.status >= 500) {
            throw new ApiError('External Geocoding Service Failed', 503);
        }
        throw new ApiError('Failed to determine location details.', 500);
    }
};

/**
 * Main function to assign report to the correct city-level official
 * @param {Number} latitude - Report location latitude
 * @param {Number} longitude - Report location longitude
 * @param {Date} date - Report creation date
 * @returns {Object} { official_id, tenure_id, city, basicAddress }
 */
const assignReportToOfficial = async (latitude, longitude, date) => {
    try {
        // Step 1: Validate inputs
        if (!latitude || !longitude) {
            throw new ApiError('Latitude and longitude are required', 400);
        }

        // Basic boundary validation
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new ApiError('Invalid coordinate values', 400);
        }

        const reportDate = date ? new Date(date) : new Date();

        // Step 2: Get City from coordinates
        const { city, pincode, state } = await getCityFromCoordinates(latitude, longitude);

        if (!city) {
            console.warn(`No city found for coordinates: ${latitude}, ${longitude}`);
            return {
                official_id: null,
                tenure_id: null,
                city: null,
                message: 'No city jurisdiction found for this location'
            };
        }

        console.log(`📍 Report location mapped to City: ${city}`);

        // Step 3: Find the official who was responsible for the city at that specific time
        // NOTE: Uses the static method defined in the modified OfficialTenure schema.
        const tenure = await OfficialTenure.findOfficialAtDate(city.toLowerCase(), reportDate)
            .populate('official', 'name email phone officialDetails')
            .lean();

        if (!tenure) {
            console.warn(`No city-level official found for ${city} at ${reportDate}`);
            return {
                official_id: null,
                tenure_id: null,
                city: city,
                message: `No city-level official assigned to ${city} during this period`
            };
        }

        console.log(`✅ Report assigned to Official: ${tenure.official.name} (${tenure.position})`);

        // Step 4: Return assignment data
        return {
            official_id: tenure.official._id,
            tenure_id: tenure._id,
            city: tenure.city,
            basicAddress: { pincode, state },
            officialDetails: {
                name: tenure.official.name,
                position: tenure.position,
                department: tenure.department,
                email: tenure.official.email,
                phone: tenure.official.phone
            }
        };

    } catch (error) {
        console.error('Assignment error:', error);
        throw error;
    }
};

/**
 * Batch assignment for multiple reports
 * Useful for data migration or bulk imports
 */
const batchAssignReportsToOfficials = async (reports) => {
    const results = [];

    for (const report of reports) {
        // Ensure coordinates are [longitude, latitude] for GeoJSON standard, but use Lat/Long for the function call
        const latitude = report.location.coordinates[1];
        const longitude = report.location.coordinates[0];

        try {
            const assignment = await assignReportToOfficial(
                latitude,
                longitude,
                report.createdAt
            );

            results.push({
                reportId: report._id,
                success: true,
                ...assignment
            });
        } catch (error) {
            results.push({
                reportId: report._id,
                success: false,
                error: error.message
            });
        }
    }

    return results;
};

/**
 * Check if an official is still responsible for a city
 * Uses the tenure ID for lookup
 */
const isOfficialStillResponsible = async (tenureId, currentDate = new Date()) => {
    const tenure = await OfficialTenure.findById(tenureId);

    if (!tenure) return false;

    // Use the virtual property defined in the schema for clean logic
    return tenure.isCurrentlyActive;
};

module.exports = {
    assignReportToOfficial,
    getCityFromCoordinates,
    batchAssignReportsToOfficials,
    isOfficialStillResponsible
};