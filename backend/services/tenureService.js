// ============================================
// services/tenureService.js
// Official Tenure Management Service Layer (MODIFIED FOR CITY-LEVEL)
// ============================================
const OfficialTenure = require('../models/OfficialTenure');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

class TenureService {
    /**
     * Creates a new tenure record for an official in a specific city.
     */
    async createTenure(tenureData) {
        // Step 1: Verify the official exists and is of type 'official'
        const official = await User.findById(tenureData.official);

        if (!official || official.userType !== 'official') {
            throw new ApiError('Invalid official reference', 400);
        }

        // Step 2: Check for overlapping tenures in the same city
        // CHANGED: Use tenureData.city instead of tenureData.ward
        const overlappingTenure = await this.checkOverlappingTenures(
            tenureData.city,
            tenureData.startDate,
            tenureData.endDate
        );

        if (overlappingTenure) {
            // CHANGED: Error message updated to reflect city jurisdiction
            throw new ApiError(
                'Another official is already assigned to this city for the specified period',
                400
            );
        }

        // Step 3: Create the tenure
        const tenure = await OfficialTenure.create(tenureData);

        // OPTIONAL: You might want to update the official's 'officialDetails.city' here
        // if they didn't have one or if it changed, using the User model.
        if (official.officialDetails?.city !== tenureData.city) {
            official.officialDetails = {
                ...official.officialDetails,
                city: tenureData.city
            };
            await official.save();
        }

        return tenure;
    }

    /**
     * Checks if a new tenure overlaps with any existing tenure for the same city.
     * @param {String} city - The city jurisdiction
     * @param {Date} startDate - The proposed start date
     * @param {Date} endDate - The proposed end date (or null/undefined for active tenure)
     * @returns {OfficialTenure | null} The overlapping tenure, if found.
     */
    async checkOverlappingTenures(city, startDate, endDate) {
        // Normalize the end date for open-ended queries
        const searchEndDate = endDate || new Date('2099-12-31');

        const query = {
            // CHANGED: Query uses 'city' field
            city: city,
            // Query logic for overlapping time periods
            $or: [
                {
                    // Case 1: Existing tenure starts within the new period
                    startDate: { $lte: searchEndDate },
                    endDate: { $gte: startDate }
                },
                {
                    // Case 2: Existing tenure is open-ended (endDate: null) and overlaps the new period
                    startDate: { $lte: searchEndDate },
                    endDate: null
                }
            ]
        };

        // Find one document that matches the overlap criteria
        return await OfficialTenure.findOne(query);
    }

    /**
     * Finds the official responsible for a city at a specific date.
     * @param {String} city - The city jurisdiction
     * @param {Date} date - The date to check
     */
    async getOfficialAtSpecificDate(city, date) {
        // CHANGED: Use the model's static method with 'city'
        return await OfficialTenure.findOfficialAtDate(city, date);
    }

    /**
     * Ends an active tenure by setting its endDate.
     */
    async endTenure(tenureId, reason) {
        const tenure = await OfficialTenure.findById(tenureId);

        if (!tenure) {
            throw new ApiError('Tenure not found', 404);
        }

        // Use the model's instance method to handle the ending logic
        await tenure.endTenure(reason);
        return tenure;
    }
}

module.exports = new TenureService();