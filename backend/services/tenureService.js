// ============================================
// services/tenureService.js
// Official Tenure Management Service Layer
// ============================================
const OfficialTenure = require('../models/OfficialTenure');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

class TenureService {
    /**
     * Creates a new tenure record for an official in a specific city.
     */
    async createTenure(tenureData) {
        const official = await User.findById(tenureData.official);

        if (!official || official.userType !== 'official') {
            throw new ApiError('Invalid official reference', 400);
        }

        const overlappingTenure = await this.checkOverlappingTenures(
            tenureData.city,
            tenureData.startDate,
            tenureData.endDate
        );

        if (overlappingTenure) {
            throw new ApiError(
                'Another official is already assigned to this city for the specified period',
                400
            );
        }

        const tenure = await OfficialTenure.create(tenureData);

        if (official.officialDetails?.city !== tenureData.city) {
            await User.updateById(official._id, {
                officialDetails: { ...official.officialDetails, city: tenureData.city },
            });
        }

        return tenure;
    }

    /**
     * Checks if a new tenure overlaps with any existing tenure for the same city.
     */
    async checkOverlappingTenures(city, startDate, endDate) {
        return OfficialTenure.findOverlapping(city, startDate, endDate);
    }

    /**
     * Finds the official responsible for a city at a specific date.
     */
    async getOfficialAtSpecificDate(city, date) {
        return OfficialTenure.findOfficialAtDate(city, date);
    }

    /**
     * Ends an active tenure by setting its endDate.
     */
    async endTenure(tenureId, reason) {
        const tenure = await OfficialTenure.findById(tenureId);

        if (!tenure) {
            throw new ApiError('Tenure not found', 404);
        }

        return OfficialTenure.endTenure(tenureId, reason);
    }
}

module.exports = new TenureService();
