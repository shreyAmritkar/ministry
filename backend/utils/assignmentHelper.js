// ============================================
// utils/assignmentHelper.js
// Core Assignment Utility Functions
// ============================================
const OfficialTenure = require('../models/OfficialTenure');
const ApiError = require('./ApiError');

/**
 * Reverse geocoding utility to get ward from coordinates
 * This can be integrated with external APIs or internal ward boundary data
 */
const getWardFromCoordinates = async (latitude, longitude) => {
    try {
        // METHOD 1: Using MongoDB Geospatial Query (if ward boundaries are stored)
        const tenure = await OfficialTenure.findOne({
            geoBoundaries: {
                $geoIntersects: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    }
                }
            },
            isActive: true
        });

        if (tenure) {
            return tenure.ward;
        }

        // METHOD 2: External Geocoding API (Google Maps, Mapbox, etc.)
        // Uncomment and configure as needed
        /*
        const axios = require('axios');
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/geocode/json`,
          {
            params: {
              latlng: `${latitude},${longitude}`,
              key: process.env.GOOGLE_MAPS_API_KEY
            }
          }
        );

        // Parse ward from address components
        const addressComponents = response.data.results[0]?.address_components || [];
        const wardComponent = addressComponents.find(
          comp => comp.types.includes('sublocality_level_2') ||
                  comp.types.includes('administrative_area_level_4')
        );

        return wardComponent?.long_name;
        */

        // METHOD 3: Fallback - Use nearest ward based on distance
        const nearestTenure = await OfficialTenure.aggregate([
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    },
                    distanceField: 'distance',
                    spherical: true,
                    maxDistance: 10000, // 10km radius
                    query: { isActive: true }
                }
            },
            { $limit: 1 }
        ]);

        if (nearestTenure.length > 0) {
            return nearestTenure[0].ward;
        }

        throw new ApiError('Unable to determine ward from coordinates', 404);
    } catch (error) {
        console.error('Ward lookup error:', error);
        throw new ApiError('Failed to determine ward from location', 500);
    }
};

/**
 * Main function to assign report to the correct official
 * @param {Number} latitude - Report location latitude
 * @param {Number} longitude - Report location longitude
 * @param {Date} date - Report creation date
 * @returns {Object} { official_id, tenure_id, ward }
 */
const assignReportToOfficial = async (latitude, longitude, date) => {
    try {
        // Step 1: Validate inputs
        if (!latitude || !longitude) {
            throw new ApiError('Latitude and longitude are required', 400);
        }

        if (latitude < -90 || latitude > 90) {
            throw new ApiError('Invalid latitude value', 400);
        }

        if (longitude < -180 || longitude > 180) {
            throw new ApiError('Invalid longitude value', 400);
        }

        const reportDate = date ? new Date(date) : new Date();

        // Step 2: Get ward from coordinates
        const ward = await getWardFromCoordinates(latitude, longitude);

        if (!ward) {
            console.warn(`No ward found for coordinates: ${latitude}, ${longitude}`);
            return {
                official_id: null,
                tenure_id: null,
                ward: null,
                message: 'No ward jurisdiction found for this location'
            };
        }

        console.log(`📍 Report location mapped to Ward: ${ward}`);

        // Step 3: Find the official who was responsible at that specific time
        const tenure = await OfficialTenure.findOne({
            ward: ward,
            startDate: { $lte: reportDate },
            $or: [
                { endDate: { $gte: reportDate } },
                { endDate: null } // Still active tenure
            ]
        })
            .populate('official', 'name email phone officialDetails')
            .lean();

        if (!tenure) {
            console.warn(`No official found for Ward ${ward} at ${reportDate}`);
            return {
                official_id: null,
                tenure_id: null,
                ward: ward,
                message: `No official assigned to ${ward} during this period`
            };
        }

        console.log(`✅ Report assigned to Official: ${tenure.official.name} (${tenure.position})`);

        // Step 4: Return assignment data
        return {
            official_id: tenure.official._id,
            tenure_id: tenure._id,
            ward: tenure.ward,
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
        try {
            const assignment = await assignReportToOfficial(
                report.location.coordinates[1], // latitude
                report.location.coordinates[0], // longitude
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
 * Check if an official is still responsible for a location
 * Useful for reassignment checks
 */
const isOfficialStillResponsible = async (tenureId, currentDate = new Date()) => {
    const tenure = await OfficialTenure.findById(tenureId);

    if (!tenure) return false;

    const isStillActive =
        tenure.startDate <= currentDate &&
        (!tenure.endDate || tenure.endDate >= currentDate);

    return isStillActive;
};

module.exports = {
    assignReportToOfficial,
    getWardFromCoordinates,
    batchAssignReportsToOfficials,
    isOfficialStillResponsible
};