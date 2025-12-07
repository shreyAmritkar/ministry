// ============================================
// services/tenureService.js
// ============================================
const OfficialTenure = require('../models/OfficialTenure');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

class TenureService {
    async createTenure(tenureData) {
        // Verify the official exists and is of type 'official'
        const official = await User.findById(tenureData.official);

        if (!official || official.userType !== 'official') {
            throw new ApiError('Invalid official reference', 400);
        }

        // Check for overlapping tenures in the same ward
        const overlappingTenure = await this.checkOverlappingTenures(
            tenureData.ward,
            tenureData.startDate,
            tenureData.endDate
        );

        if (overlappingTenure) {
            throw new ApiError(
                'Another official is already assigned to this ward for the specified period',
                400
            );
        }

        const tenure = await OfficialTenure.create(tenureData);
        return tenure;
    }

    async checkOverlappingTenures(ward, startDate, endDate) {
        const query = {
            ward: ward,
            isActive: true,
            $or: [
                {
                    startDate: { $lte: endDate || new Date('2099-12-31') },
                    endDate: { $gte: startDate }
                },
                {
                    startDate: { $lte: endDate || new Date('2099-12-31') },
                    endDate: null
                }
            ]
        };

        return await OfficialTenure.findOne(query);
    }

    async getOfficialAtSpecificDate(ward, date) {
        return await OfficialTenure.findOfficialAtDate(ward, date);
    }

    async endTenure(tenureId, reason) {
        const tenure = await OfficialTenure.findById(tenureId);

        if (!tenure) {
            throw new ApiError('Tenure not found', 404);
        }

        await tenure.endTenure(reason);
        return tenure;
    }
}

module.exports = new TenureService();